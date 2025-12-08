import { getSP } from "../../PNPConfig/pnpjsConfig";
import { SPFI, spfi } from "@pnp/sp";
import * as strings from 'BmasterWebPartStrings';
import {
  ISPLookUp,
  ICourseSections,
  IGalleryItem,
  ICoursesPhotos,
  ICoursesDates,
  ICourseSyllabus
} from "../Interface/BmasterSPListInterface";


export class Utilities {
  private _sp: SPFI;
  private _Utilities: Utilities;
  private List_NAME_CourseSections = strings.CourseSections;
  private List_NAME_PhotoGallerySlideshow = strings.PhotoGallerySlideshow;
  private List_NAME_CoursesListName = strings.CoursesListName;
  private List_NAME_CoursePhotosListName = strings.CoursePhotosListName;
  private List_NAME_CourseSyllabusListName = strings.CourseSyllabusListName;
  private List_NAME_CourseActualListName = strings.CourseActualListName; // קורס בפועל
  private List_NAME_CourseRegistrationListName = strings.CourseRegistrationListName; // נרשמים לקורס
  private List_NAME_CoursesMeetingsListName = strings.CoursesMeetingsListName; // נרשמים לקורס


  constructor() {
    this._sp = getSP();
  }


  public GetQueryFilterServiceProvidersList() { }


  public _getAllCourseSections = async (): Promise<ICourseSections[]> => {
    const spCache = this._sp;
    const items: ICourseSections[] = await spCache.web.lists
      .getByTitle(this.List_NAME_CourseSections)
      .items
      .filter("(IsHidden eq false or IsHidden eq null)")();
    return items;
  }


  public getCategoryTitleByCourseID = async (): Promise<any[]> => {
    const spCache = this._sp;
    const url: any = new URL(window.location.href);
    let _CourseID = url.searchParams.get("CourseID");
    const _ActualCourseID = url.searchParams.get("ActualCourseID");
    const _SectionID = url.searchParams.get("SectionID");

    // If SectionID is provided, skip course lookup and return the section directly
    if (_SectionID) {
      const category: ICourseSections[] = await spCache.web.lists
        .getByTitle(this.List_NAME_CourseSections)
        .items.select("isCategory", "Title", "field", "ID", "field/Title")
        .expand("field")
        .filter(`ID eq ${_SectionID}`)
        .top(1)();

      return category;
    }

    // If ActualCourseID is provided, get the real CourseID from courseName
    if (_ActualCourseID) {
      const actualCourse: any[] = await spCache.web.lists
        .getByTitle(this.List_NAME_CourseActualListName)
        .items.select("ID", "courseName/ID")
        .expand("courseName")
        .filter(`ID eq ${_ActualCourseID}`)
        .top(1)();

      _CourseID = actualCourse[0].courseName.ID;
    }

    // Lookup the course
    const course: any[] = await spCache.web.lists
      .getByTitle(this.List_NAME_CoursesListName)
      .items.select("ID", "Title", "theSection/ID")
      .expand("theSection")
      .filter(`ID eq ${_CourseID}`)
      .top(1)();

    const category: ICourseSections[] = await spCache.web.lists
      .getByTitle(this.List_NAME_CourseSections)
      .items.select("isCategory", "Title", "field", "ID", "field/Title")
      .expand("field")
      .filter(`ID eq ${course[0].theSection.ID}`)
      .top(1)();

    return category;
  };



  public async areSeatsAvailableForAllActualCourses(courseId: string): Promise<boolean> {
    try {
      const spCache = this._sp;
      const isoNow = new Date().toISOString();

      const courseActuals: any[] = await spCache.web.lists
        .getByTitle(this.List_NAME_CourseActualListName)
        .items
        .select("ID", "startDate", "currentListed", "maxListed", "courseName/ID")
        .expand("courseName")
        .filter(`startDate gt '${isoNow}' and courseName/ID eq ${courseId}`)
        .top(4999)();

      if (courseActuals.length === 0) {
        console.warn("No upcoming actual courses found for course ID:", courseId);
        return false;
      }

      // Return true if at least one course has seats available
      const anyHasSeat = courseActuals.some(actual => actual.currentListed < actual.maxListed);
      return anyHasSeat;

    } catch (error) {
      console.error("Error checking seat availability for course:", error);
      return false;
    }
  }




  public _getCoursesBySectionID = async (): Promise<any[]> => {
    console.log("Function _getCoursesBySectionID invoked.");

    const url: any = new URL(window.location.href);
    const _SectionID = url.searchParams.get("SectionID");
    console.log("Extracted _SectionID:", _SectionID);

    if (_SectionID == null) {
      console.error("No SectionID found in URL, returning null.");
      return null;
    }

    const spCache = this._sp;

    console.log("Fetching courses from list:", this.List_NAME_CoursesListName);
    const courses: any[] = await spCache.web.lists
      .getByTitle(this.List_NAME_CoursesListName)
      .items.select("ID", "Title", "Lessons", "otherLink", "innerText1", "innerText2", "position", "IsHidden")
      .filter(`theSectionId eq ${_SectionID} and (IsHidden eq 0 or IsHidden eq null)`)
      .top(4999)();
    console.log("Courses fetched:", courses);

    const now = new Date();
    const isoNow = now.toISOString();
    console.log("Current date/time (ISO):", isoNow);

    console.log("Fetching course actuals from list:", this.List_NAME_CourseActualListName);
    const courseActuals: any[] = await spCache.web.lists
      .getByTitle(this.List_NAME_CourseActualListName)
      .items.select("ID", "startDate", "currentListed", "maxListed", "courseName/ID")
      .expand("courseName")
      .filter(`startDate gt '${isoNow}'`)
      .top(4999)();
    console.log("Course actuals fetched:", courseActuals);

    console.log("Enriching course data with sold out flags...");
    const enrichedCourses = courses.map(course => {
      const hasOtherLink = !!(course.otherLink && course.otherLink.trim());

      if (hasOtherLink) {
        return {
          ...course,
          isSoldOut: false
        };
      }

      const matchingActuals = courseActuals.filter(actual =>
        actual.courseName.ID === course.ID && actual.currentListed < actual.maxListed
      );

      const hasAvailableSeats = matchingActuals.length > 0;

      return {
        ...course,
        isSoldOut: !hasAvailableSeats
      };
    });

    // Remove courses that have no upcoming actuals at all
    const filteredCourses = enrichedCourses.filter(course => {
      const matchingActuals = courseActuals.filter(actual =>
        actual.courseName.ID === course.ID
      );

      return matchingActuals.length > 0 || !!(course.otherLink && course.otherLink.trim());
    });

    console.log("Final filtered course list:", filteredCourses);
    return filteredCourses;
  }




  public _getAllCoursesSmallPhoto = async (): Promise<ICoursesPhotos[]> => {
    const spCache = this._sp;
    const items: ICoursesPhotos[] = await spCache.web.lists.getByTitle(this.List_NAME_CoursePhotosListName).items.select("ID", "FileLeafRef", "FileRef", "courseName/Title", "courseName/ID", "courseName/otherLink").expand("courseName")
      .filter("photoType eq 'תמונה קטנה'")
      .top(4999)();
    return items;
  }


  public _getCoursesInfoPhotoByCourseID = async (CourseID: string): Promise<ICoursesPhotos[]> => {
    const spCache = this._sp;
    const items: ICoursesPhotos[] = await spCache.web.lists.getByTitle(this.List_NAME_CoursePhotosListName).items.select("ID", "FileLeafRef", "FileRef", "courseName/Title", "courseName/ID").expand("courseName")
      .filter("photoType eq 'תמונה גדולה' and courseNameId eq " + CourseID)
      .top(1)();
    const courseItem = await spCache.web.lists
      .getByTitle(this.List_NAME_CoursesListName)
      .items
      .select("ID", "description", "silabusButton", "signButton")
      .filter(`ID eq ${CourseID}`)
      .top(1)();
    // Step 3: Add the Course Description and Buttons to Each Item
    if (courseItem.length > 0) {
      items.forEach(item => {
        (item as any).description = courseItem[0].description; // Add description field
        (item as any).silabusButton = courseItem[0].silabusButton; // Add silabusButton field
        (item as any).signButton = courseItem[0].signButton; // Add signButton field
      });
    }
    console.log(items[0].description);
    return items;
  }


  public _getCourseSignInfoPhotoByCourseID = async (CourseID: string): Promise<ICoursesPhotos[]> => {
    const spCache = this._sp;
    const items: ICoursesPhotos[] = await spCache.web.lists.getByTitle(this.List_NAME_CoursePhotosListName).items.select("ID", "FileLeafRef", "FileRef", "courseName/Title", "courseName/ID").expand("courseName")
      .filter("photoType eq 'תמונה קטנה' and courseNameId eq " + CourseID)
      .top(1)();
    return items;
  }


  public _getCourseSignOptionsByCourseID = async (CourseID: string): Promise<ICoursesDates[]> => {
    const spCache = this._sp;
    const now = new Date().toISOString();

    // Step 1: Fetch the main course items
    const items: ICoursesDates[] = await spCache.web.lists
      .getByTitle(this.List_NAME_CourseActualListName)
      .items.select(
        "ID",
        "FileLeafRef",
        "FileRef",
        "courseName/Title",
        "courseName/ID",
        "finishDate",
        "startDate",
        "currentListed",
        "maxListed",
        "location"
      )
      .expand("courseName")
      .filter(`courseName/ID eq '${CourseID}' and startDate gt '${now}'`)
      .orderBy("startDate", true)();

    const filteredItems = items.filter(item => item.currentListed < item.maxListed);

    if (filteredItems.length === 0) return filteredItems;

    // Step 2: For each course, fetch its related meetings directly
    await Promise.all(
      filteredItems.map(async (course) => {
        const meetings = await spCache.web.lists
          .getByTitle(this.List_NAME_CoursesMeetingsListName)
          .items.select("startDate", "endDate", "location", "actualCourse/ID", "ID")
          .expand("actualCourse")
          .filter(`actualCourse/ID eq ${course.ID}`)();

        course.meetings = meetings.map(meeting => ({
          startDate: meeting.startDate,
          finishDate: meeting.endDate,
          location: meeting.location ? meeting.location : course.location,
          ID: meeting.ID
          //location: meeting.location,
        }));
      })
    );

    return filteredItems;
  };



  public _getActualCourseByActualCourseID = async (ActualCourseID: string): Promise<ICoursesDates[]> => {
    const spCache = this._sp;
    const items: ICoursesDates[] = await spCache.web.lists
      .getByTitle(this.List_NAME_CourseActualListName)
      .items.select(
        "ID",
        "FileLeafRef",
        "FileRef",
        "courseName/Title",
        "courseName/ID",
        "finishDate",
        "startDate",
        "currentListed",
        "maxListed",
        "CourseID"
      )
      .expand("courseName")
      .filter(`ID eq '${ActualCourseID}'`)
      .orderBy("startDate", true)();
    return items;
  };


  public _getCourseSyllabusByCourseID = async (CourseID: string): Promise<ICourseSyllabus[]> => {
    const spCache = this._sp;
    const items: ICourseSyllabus[] = await spCache.web.lists.getByTitle(this.List_NAME_CourseSyllabusListName).items.select("ID", "FileLeafRef", "FileRef", "courseName/Title", "courseName/ID").expand("courseName")
      .filter("courseNameId eq " + CourseID)
      .top(1)();
    return items;
  }


  public _getAllPhotoGallerySlideshow = async (): Promise<any[]> => {
    const spCache = this._sp;
    const items: any[] = await spCache.web.lists.getByTitle(this.List_NAME_PhotoGallerySlideshow).items.select("Title1", "Title2", "Title3", "FileLeafRef", "FileRef", "Description1", "Link").orderBy("theOrder")();
    return items;
  }


  public _getIfUserCanRegister = async (
    userEmail: string,
    currentCourseId: string
  ): Promise<"not_registered" | "registered_other_course" | "registered_current_course"> => {
    try {
      const spCache = this._sp;

      console.log("Checking registration for user email:", userEmail, "and course ID:", currentCourseId);

      const items = await spCache.web.lists
        .getByTitle(this.List_NAME_CourseRegistrationListName)
        .items.filter(`listedName/EMail eq '${userEmail}'`)
        .select("ID", "listedName/EMail", "courseName/ID", "practicalCourse/startDate")
        .expand("listedName", "courseName", "practicalCourse")();

      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      // ✅ New logic: check if the user was registered to ANY course in the past year
      const hasCourseInLastYear = items.some(item =>
        new Date(item.practicalCourse.startDate) > oneYearAgo
      );

      const hasUpcomingOtherCourse = items.some(item =>
        item.courseName.ID !== Number(currentCourseId) &&
        new Date(item.practicalCourse.startDate) > today
      );

      if (items.length === 0 || (!hasCourseInLastYear && !hasUpcomingOtherCourse)) {
        return "not_registered";
      }

      const isRegisteredForCurrentCourse = items.some((item) => {
        console.log("Start Date:", item.practicalCourse.startDate);
        console.log("Today's Date:", today);
        return (
          item.courseName.ID === Number(currentCourseId) &&
          new Date(item.practicalCourse.startDate) > today
        );
      });

      if (isRegisteredForCurrentCourse) {
        return "registered_current_course";
      }

      return "registered_other_course";
    } catch (error) {
      console.error("Error checking user registration status:", error);
      return "not_registered";
    }
  };



  public registerUser = async (courseName: number, practicalCourse: number) => {
    try {
      const sp = getSP(); // Initialize PnP.js instance
      const listName = this.List_NAME_CourseRegistrationListName; // Replace with your actual SharePoint list name
      // Retrieve the current user's login name
      const currentUser = await sp.web.currentUser(); // Fetches current user details
      // Add a new item with the provided fields and the current user's details
      const result = await sp.web.lists.getByTitle(listName).items.add({
        courseNameId: courseName, // Assuming the Title field is for courseName
        practicalCourseId: practicalCourse, // Field for practical course
        listedNameId: currentUser.Id // SharePoint person field requires the user's ID
      });
      console.log("Item added successfully:", result.data); // Logs the added item details
    } catch (error) {
      console.error("Error adding item to the list:", error); // Logs errors if any
    }
  };


  public addRegisterdNumber = async (itemId: number) => {
    try {
      const sp = getSP(); // Initialize PnP.js instance
      const listName = this.List_NAME_CourseActualListName; // Replace with your actual list name
      // Retrieve the current value of the item
      const item = await sp.web.lists.getByTitle(listName).items.getById(itemId).select("currentListed")();
      // Check if the column exists and has a valid value
      if (item && item.currentListed != null) {
        const currentListed = item.currentListed;
        // Increment the value by 1 and update the item
        await sp.web.lists.getByTitle(listName).items.getById(itemId).update({
          currentListed: currentListed + 1
        });
        console.log(`Updated item ${itemId}: currentListed is now ${currentListed + 1}`);
      } else {
        console.error(`Item ${itemId} does not have a valid currentListed value.`);
      }
    } catch (error) {
      console.error("Error updating currentListed:", error);
    }
  };


  public async getRegistrationItemId(userEmail: string): Promise<object | null> {
    try {
      const spCache = this._sp;
      // Debug: Log the userEmail
      console.log("Checking registration for user email:", userEmail);
      // Query the list to find all items by the user's email
      const items = await spCache.web.lists
        .getByTitle(this.List_NAME_CourseRegistrationListName)
        .items.filter(`listedName/EMail eq '${userEmail}'`) // Filter by the user's email
        .select("ID", "listedName/EMail", "practicalCourse/ID", "practicalCourse/startDate") // Fetch required fields
        .expand("listedName", "practicalCourse") // Expand the person & lookup fields
        () // Get all matching items
      // Debug: Log the items returned
      console.log("Query result:", items);
      if (items.length === 0) {
        return null; // No items found, return null
      }
      // Sort items by practicalCourse.startDate in descending order (latest first)
      const sortedItems = items.sort((a, b) =>
        new Date(b.practicalCourse.startDate).getTime() - new Date(a.practicalCourse.startDate).getTime()
      );
      // Return the first item (latest practical course)
      return { id: sortedItems[0].ID, practicalCourse: sortedItems[0].practicalCourse.ID };
    } catch (error) {
      console.error("Error retrieving registration item ID:", error);
      return null; // Return null in case of an error
    }
  }


  public _fetchMergedCourseData = async (searchQuery: string): Promise<{ title: string; description: string; link: string; image?: string }[]> => {
    try {
      const spCache = this._sp;
      // Fetch Course Sections (Title, addedText, ID, Image)
      const sectionList = await spCache.web.lists
        .getByTitle(this.List_NAME_CourseSections)
        .items.select("ID", "Title", "addedText", "theImage/Url")() // Select ID for link construction
        .catch((error: any): any[] => {
          console.error("Error fetching Course Sections:", error);
          return [];
        });
      // Fetch Courses (Title, description, ID)
      const courseList = await spCache.web.lists
        .getByTitle(this.List_NAME_CoursesListName)
        .items.select("ID", "Title", "description", "otherLink")() // Select ID for link construction
        .catch((error: any): any[] => {
          console.error("Error fetching Courses:", error);
          return [];
        });
      // Fetch Course Images
      const courseImages: ICoursesPhotos[] = await this._getAllCoursesSmallPhoto();
      // Create a map for quick lookups
      const courseImageMap: { [key: string]: string } = {};
      for (const image of courseImages) {
        if (image.courseName && image.courseName.ID) {
          courseImageMap[image.courseName.ID] = image.FileRef; // Store image URL by course ID
        }
      }
      // Combine both lists into a single array with links
      const combinedList = [
        ...sectionList.map(section => ({
          title: section.Title,
          description: section.addedText, // Using addedText for sections
          link: `https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/Courses.aspx?SectionID=${section.ID}`,
          image: section.theImage.Url
        })),
        ...courseList.map(course => ({
          title: course.Title,
          description: course.description, // Using description for courses
          link: course.otherLink && course.otherLink.trim() !== ""
            ? course.otherLink
            : `https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/OneCourse.aspx?CourseID=${course.ID}`,
          image: courseImageMap[course.ID] || undefined // Get image from the map or leave undefined
        }))
      ];
      // Filter the combined list based on the search query
      const filteredList = combinedList.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      return filteredList;
    } catch (error) {
      console.error("Error in _fetchMergedCourseData:", error);
      return [];
    }
  };


  public async removeRegistrations(itemId: number): Promise<void> {
    const sp = getSP(); // Initialize the SP instance
    const listName = this.List_NAME_CourseRegistrationListName; // Replace with the actual SharePoint list name
    // Call the SharePoint API to delete the item by ID
    await sp.web.lists.getByTitle(listName).items.getById(itemId).delete();
  }
  public subtractRegisterdNumber = async (itemId: number) => {
    try {
      const sp = getSP();
      const listName = this.List_NAME_CourseActualListName;
      // Retrieve the current value of the item
      const item = await sp.web.lists.getByTitle(listName).items.getById(itemId).select("currentListed")();
      // Check if the column exists and has a valid value
      if (item && item.currentListed != null) {
        const currentListed = item.currentListed;
        // Increment the value by 1 and update the item
        await sp.web.lists.getByTitle(listName).items.getById(itemId).update({
          currentListed: currentListed - 1
        });
        console.log(`Updated item ${itemId}: currentListed is now ${currentListed + 1}`);
      } else {
        console.error(`Item ${itemId} does not have a valid currentListed value.`);
      }
    } catch (error) {
      console.error("Error updating currentListed:", error);
    }
  };
}
