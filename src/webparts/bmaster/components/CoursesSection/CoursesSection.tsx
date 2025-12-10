import * as React from 'react';
import styles from './CoursesSection.module.scss';
//import type { IBmasterProps } from './IBmasterProps';
import { escape } from '@microsoft/sp-lodash-subset';
import { SPFI, spfi } from "@pnp/sp";
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { Item, Items } from '@pnp/sp/items';
import { PeoplePicker, PrincipalType } from "@pnp/spfx-controls-react/lib/PeoplePicker";
import { MSGraphClientV3 } from '@microsoft/sp-http-msgraph';
import "@pnp/graph/groups";
import "@pnp/graph/users";


//Import font Awesome
import { SPComponentLoader } from '@microsoft/sp-loader';

import { ICourseSections, ICoursesPhotos } from "../Interface/BmasterSPListInterface";

export interface ICoursesSectionProps {
    title?: string;
    context: any;
}

export interface ICoursesSectionState {
    items: any[];
    itemsPhotos: ICoursesPhotos[];
    sectionsItems: ICourseSections[];
    likeCounts: { [key: number]: number };
    commentCounts: { [key: number]: number };
    showLikesPopup: boolean;
    likedUsers: string[];
    showCommentPopup: boolean;
    commentText: string;
    activeCourseId: number | null;
    activeSectionId: number | null;
    showCommentsPopup: boolean;
    commentsList: { author: string; text: string }[];
    showPeoplePickerPopup: boolean;
    selectedUsers: any[];
    allowedUsers: any[];
    filteredUsers: any[];
    searchText: string;
    isLoadingUsers: boolean;
    selectedCourse?: {
        Title: string;
        Link: string;
    };
    isSharing: boolean;

}

export default class CoursesSection extends React.Component<ICoursesSectionProps, ICoursesSectionState, {}> {

    private _sp: SPFI;
    private _Utilities: Utilities;

    constructor(props: ICoursesSectionProps) {
        super(props);
        // set initial state
        this.state = {
            items: [],
            itemsPhotos: [],
            sectionsItems: [],
            likeCounts: {},
            commentCounts: {},
            showLikesPopup: false,
            likedUsers: [],
            showCommentPopup: false,
            commentText: "",
            activeCourseId: null,
            activeSectionId: null,
            showCommentsPopup: false,
            showPeoplePickerPopup: false,
            selectedUsers: [],
            allowedUsers: [],
            commentsList: [],
            filteredUsers: [],
            searchText: "",
            isLoadingUsers: false,
            isSharing: false
        };
        this._sp = getSP();
        this._Utilities = new Utilities();

        //Add Font Awesome
        SPComponentLoader.loadCss('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');
        //this.handleCallShowHideModal = this.handleCallShowHideModal.bind(this);
        this._getItems();
    }

    // Add new hover functionality methods
    private closeIt = (x: string): void => {
        const y = "d" + x;
        const z = "e" + x;
        const w = "f" + x;
        const yElem = document.getElementById(y);
        const zElem = document.getElementById(z);
        const wElem = document.getElementById(w);
        if (yElem) {
            yElem.style.marginTop = "190px";
            yElem.style.backgroundPositionX = "43.5%";
        }
        if (zElem) zElem.style.display = "none";
        if (wElem) wElem.style.marginTop = "10px";
    }

    private handleMouseOver = (i: number): void => {
        const x1 = i.toString();
        const y = "d" + x1;
        const z = "e" + x1;
        const w = "f" + x1;

        const yElem = document.getElementById(y);
        const zElem = document.getElementById(z);
        const wElem = document.getElementById(w);

        if (yElem) {
            yElem.style.marginTop = "20px";
            yElem.style.backgroundPositionX = "62.5%";
        }
        if (zElem) zElem.style.display = "inline";
        if (wElem) wElem.style.marginTop = "70px";
    };

    private handleMouseLeave = (i: number): void => {
        this.closeIt(i.toString());
    };


    private async _getItems() {
        // 1️⃣ Fetch all main data in parallel
        const [items, sectionsItems, itemsPhotos] = await Promise.all([
            this._Utilities._getCoursesBySectionID(),
            this._Utilities._getAllCourseSections(),
            this._Utilities._getAllCoursesSmallPhoto()
        ]);

        this.setState({ items, sectionsItems, itemsPhotos });
        console.table(items);
        console.table(sectionsItems);
        console.table(itemsPhotos);

        // 2️⃣ Fetch all like counts in parallel
        const likePromises = items.map((course) => this._getLikesCount(course.ID, null));
        const likeResults = await Promise.all(likePromises);

        const likeCounts: { [key: number]: number } = {};
        items.forEach((course, index) => {
            likeCounts[course.ID] = likeResults[index];
        });

        // 3️⃣ Fetch all comment counts in parallel (for courses and sections)
        const courseCommentPromises = items.map((course) => this._getCommentsCount(course.ID, null));
        const sectionCommentPromises = sectionsItems.map((section) => this._getCommentsCount(null, section.ID));

        const [courseCommentResults, sectionCommentResults] = await Promise.all([
            Promise.all(courseCommentPromises),
            Promise.all(sectionCommentPromises)
        ]);

        const commentCounts: { [key: number]: number } = {};
        items.forEach((course, index) => {
            commentCounts[course.ID] = courseCommentResults[index];
        });
        sectionsItems.forEach((section, index) => {
            commentCounts[section.ID] = sectionCommentResults[index];
        });

        // 4️⃣ Save both counts at once
        this.setState({ likeCounts, commentCounts });

        // 5️⃣ Fetch group members last (optional, since it can take a second)
        await this._logGroupMembers();
    }


    private async _logGroupMembers(): Promise<void> {
        try {
            this.setState({ isLoadingUsers: true });

            const groupName = "BMASTER";
            const graphClient = await (this.props as any).context.msGraphClientFactory.getClient('3');

            const groupResponse = await graphClient
                .api(`/groups`)
                .filter(`displayName eq '${groupName}'`)
                .select("id,displayName,mail")
                .get();

            if (!groupResponse.value || groupResponse.value.length === 0) {
                console.warn(`❌ Group '${groupName}' not found.`);
                this.setState({ isLoadingUsers: false });
                return;
            }

            const group = groupResponse.value[0];
            console.log(`✅ Found group: ${group.displayName} (${group.id})`);

            // Get all members (handle pagination)
            let response = await graphClient.api(`/groups/${group.id}/transitiveMembers`).get();
            let members: any[] = [...response.value];

            while (response["@odata.nextLink"]) {
                response = await graphClient.api(response["@odata.nextLink"]).get();
                members = [...members, ...response.value];
            }

            const userMembers = members.filter(m => m['@odata.type'] === '#microsoft.graph.user');

            // Clean display names
            const cleanHebrewName = (name: string): string => {
                if (!name) return "";
                return name
                    .replace(/[A-Za-z]/g, "")
                    .replace(/\s{2,}/g, " ")
                    .replace(/[-–]\s*$/, "")
                    .trim();
            };

            const formattedUsers = userMembers.map(u => ({
                text: cleanHebrewName(u.displayName || ""),
                id: u.id,
                email: u.mail || u.userPrincipalName
            }));

            this.setState({
                allowedUsers: formattedUsers,
                filteredUsers: formattedUsers,
                isLoadingUsers: false
            });

            console.log(`✅ Saved ${userMembers.length} users for PeoplePicker`);

        } catch (error) {
            console.error("❌ Error fetching group members:", error);
            this.setState({ isLoadingUsers: false });
        }
    }




    private _getHtml(_ItemID: any) {
        let _htmlJSX = null;
        if (this.state.itemsPhotos.length > 0) {
            const itemsPhotos: ICoursesPhotos[] = this.state.itemsPhotos;
            const _fileURl = itemsPhotos.filter(item => item.courseName.ID === _ItemID);
            if (_fileURl.length > 0)
                _htmlJSX = _fileURl[0].FileRef;
        }
        return _htmlJSX;
    }

    private extractTeudatZehutFromClaims(login: string): string | null {
        if (!login) return null;
        const match = login.match(/(\d{7,9})/);
        return match ? match[1] : null;
      }
      
      private extractTeudatZehutFromUpn(login: string): string | null {
        if (!login) return null;
        const parts = login.split('|');
        const lastPart = parts[parts.length - 1] || login;
        const upn = lastPart.split('@')[0];
        const match = upn.match(/^(\d{7,9})$/);
        return match ? match[1] : null;
      }

      private async logCourseClick(course: any, targetUrl: string): Promise<void> {
        try {
          const currentUser: any = await this._sp.web.currentUser();
          const userName: string = currentUser.Title || '';
          const loginName: string = currentUser.LoginName || '';
      
          const tzFromClaims = this.extractTeudatZehutFromClaims(loginName);
          const teudatZehut = tzFromClaims || this.extractTeudatZehutFromUpn(loginName);
      
          let absoluteUrl: string;
      
          if (targetUrl && (targetUrl.indexOf('http://') === 0 || targetUrl.indexOf('https://') === 0)) {
            absoluteUrl = targetUrl;
          } else {
            const needsSlash = targetUrl && targetUrl.charAt(0) !== '/' ? '/' : '';
            absoluteUrl = window.location.origin + needsSlash + targetUrl;
          }
      
          await this._sp.web.lists.getByTitle('BezeqStatistics').items.add({
            Title: course.Title,
            PageType: 'קורס',
            UserNameText: userName,
            Link: absoluteUrl,
            PageID: String(course.ID),
            Tas: teudatZehut || ''
          });
      
        } catch (error) {
          console.error('❌ Error logging course click:', error);
        }
      }
      
      private async handleCourseClick(Course: any): Promise<void> {
        // אם יש otherLink – נשתמש בו, אחרת נעבור לדף הקורס הרגיל בלי ספירה
        if (Course.otherLink && Course.otherLink.trim() !== '') {
          const targetUrl: string = Course.otherLink;
          const lower = targetUrl.toLowerCase();
      
          // אם היעד *לא* דף קורס/תחום – נספור כניסה
          if (lower.indexOf('onecourse.aspx') === -1 && lower.indexOf('courses.aspx') === -1) {
            try {
              await this.logCourseClick(Course, targetUrl);
            } catch (e) {
              console.error('Failed to log course click', e);
            }
          }
      
          window.location.href = targetUrl;
        } else {
          // בלי otherLink – זה דף קורס רגיל, הספירה נעשית ב-BPageCount
          this._goToOneCourse(Course.ID);
        }
      }
      

    private _goToOneCourse(_ItemID: any) {
        // debugger;
        let __OneCourseUrl = "/sites/Bmaster/SitePages/OneCourse.aspx?CourseID=";
        __OneCourseUrl += _ItemID;
        window.location.href = __OneCourseUrl;
    }

    //Like / Unlike Function
    private async _handleLikeClick(
        courseId: number | null,
        courseTitle: string,
        sectionId: number | null
    ): Promise<void> {
        try {
            const currentUser = await this._sp.web.currentUser();

            const isCourseLike = courseId !== null;
            const isSectionLike = !isCourseLike && sectionId !== null;

            if (!isCourseLike && !isSectionLike) {
                console.warn("⚠️ No courseId or sectionId provided — cannot save like.");
                return;
            }

            // Check if user already liked this item
            const existingLikes = await this._sp.web.lists
                .getByTitle("Likes")
                .items.filter(
                    `likedBy/Id eq ${currentUser.Id} and ${isCourseLike
                        ? `courseID eq ${courseId}`
                        : `sectionID eq ${sectionId}`
                    }`
                )();

            if (existingLikes.length > 0) {
                // User already liked - remove the like
                const likeId = existingLikes[0].Id;
                await this._sp.web.lists.getByTitle("Likes").items.getById(likeId).delete();
                console.log(`❌ Like removed for ${courseTitle}`);

                // Update count immediately
                const newCount = await this._getLikesCount(courseId, sectionId);
                this.setState(prev => ({
                    likeCounts: { ...prev.likeCounts, [courseId ?? sectionId!]: newCount }
                }));

                return;
            }

            // Add new like (People Picker field)
            await this._sp.web.lists.getByTitle("Likes").items.add({
                Title: courseTitle,
                courseID: courseId,
                sectionID: sectionId,
                likedById: currentUser.Id // People Picker reference
            });

            console.log(`✅ Like saved for ${courseTitle}`);

            // Update count immediately
            const newCount = await this._getLikesCount(courseId, sectionId);
            this.setState(prev => ({
                likeCounts: { ...prev.likeCounts, [courseId ?? sectionId!]: newCount }
            }));

        } catch (error) {
            console.error("❌ Error toggling like:", error);
        }
    }


    // Get total likes count
    private async _getLikesCount(
        courseId: number | null,
        sectionId: number | null
    ): Promise<number> {
        try {
            const filter =
                courseId !== null
                    ? `courseID eq ${courseId}`
                    : `sectionID eq ${sectionId}`;

            const likes = await this._sp.web.lists
                .getByTitle("Likes")
                .items.filter(filter)
                .select("ID")();

            return likes.length;
        } catch (error) {
            console.error("Error fetching like count:", error);
            return 0;
        }
    }

    // Get total comments count
    private async _getCommentsCount(
        courseId: number | null,
        sectionId: number | null
    ): Promise<number> {
        try {
            let filter = "";

            if (courseId !== null) {
                // count comments linked to this course
                filter = `(courseID eq ${courseId} or sectionID eq ${courseId})`;
            } else if (sectionId !== null) {
                // count comments linked to this section
                filter = `(sectionID eq ${sectionId} or courseID eq ${sectionId})`;
            } else {
                console.warn("⚠️ No courseId or sectionId provided — cannot fetch comments.");
                return 0;
            }

            const comments = await this._sp.web.lists
                .getByTitle("Comments")
                .items.filter(filter)
                .select("ID")();

            return comments.length;
        } catch (error) {
            console.error("❌ Error fetching comment count:", error);
            return 0;
        }
    }




    // Fetch all users who liked a course or section
    private async _getLikedUsers(courseId: number | null, sectionId: number | null): Promise<void> {
        try {
            const filter =
                courseId !== null
                    ? `courseID eq ${courseId}`
                    : `sectionID eq ${sectionId}`;

            const likes = await this._sp.web.lists
                .getByTitle("Likes")
                .items.filter(filter)
                .select("likedBy/Title", "likedBy/EMail")
                .expand("likedBy")();

            const cleanHebrewName = (name: string): string => {
                if (!name) return "";
                return name
                    .replace(/[A-Za-z*]/g, "")   // remove English letters and asterisks
                    // .replace(/[-–]+/g, "")       // remove hyphens/dashes
                    .replace(/\s{2,}/g, " ")     // collapse multiple spaces
                    .replace(/[-–]\s*$/, "")       // remove only a trailing hyphen (and optional space)
                    .trim();
            };

            const userNames = likes
                .filter(l => l.likedBy)
                .map(l => cleanHebrewName(l.likedBy.Title));


            this.setState({
                likedUsers: userNames,
                showLikesPopup: true
            });
        } catch (error) {
            console.error("Error fetching liked users:", error);
        }
    }

    // Fetch all comments for a course or section
    private async _getCommentsList(courseId: number | null, sectionId: number | null): Promise<void> {
        try {
            let filter = "";

            if (courseId !== null) {
                filter = `(courseID eq ${courseId} or sectionID eq ${courseId})`;
            } else if (sectionId !== null) {
                filter = `(sectionID eq ${sectionId} or courseID eq ${sectionId})`;
            } else {
                console.warn("⚠️ No courseId or sectionId provided — cannot fetch comments list.");
                return;
            }

            const comments = await this._sp.web.lists
                .getByTitle("Comments")
                .items.filter(filter)
                .select("comment", "commentedBy/Title", "commentedBy/EMail")
                .expand("commentedBy")();

            const cleanHebrewName = (name: string): string => {
                if (!name) return "";
                return name
                    .replace(/[A-Za-z*]/g, "") // remove English letters and asterisks
                    .replace(/\s{2,}/g, " ")   // collapse double spaces
                    .replace(/[-–]+/g, "")
                    .trim();
            };

            const formattedComments = comments.map((c: any) => ({
                author: cleanHebrewName(c.commentedBy?.Title || "לא ידוע"),
                text: c.comment || ""
            }));


            this.setState({
                commentsList: formattedComments,
                showCommentsPopup: true
            });
        } catch (error) {
            console.error("❌ Error fetching comments list:", error);
        }
    }


    // Close popup
    private _closeLikesPopup = (): void => {
        this.setState({ showLikesPopup: false, likedUsers: [] });
    };

    private _closeCommentsPopup = (): void => {
        this.setState({ showCommentsPopup: false, commentsList: [] });
    };


    // Open Comment Popup for a specific course or section
    private _openCommentPopup = (courseId: number | null, sectionId: number | null): void => {
        this.setState({
            showCommentPopup: true,
            activeCourseId: courseId,
            activeSectionId: sectionId
        });
    };

    // Close Comment Popup
    private _closeCommentPopup = (): void => {
        this.setState({ showCommentPopup: false, commentText: "" });
    };

    // Handle Text Input
    private _handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ commentText: e.target.value });
    };

    // Save Comment Function
    private async _handleSendComment(
        courseId: number | null,
        sectionId: number | null
    ): Promise<void> {
        try {
            const currentUser = await this._sp.web.currentUser();

            if (!this.state.commentText.trim()) {
                console.warn("Please enter a comment before sending.");
                return;
            }

            const isCourseComment = courseId !== null;
            const isSectionComment = !isCourseComment && sectionId !== null;

            if (!isCourseComment && !isSectionComment) {
                console.warn("⚠️ No courseId or sectionId provided — cannot save comment.");
                return;
            }

            // Add comment to SharePoint list
            await this._sp.web.lists.getByTitle("Comments").items.add({
                comment: this.state.commentText,
                commentedById: currentUser.Id, // People Picker field
                courseID: courseId,
                sectionID: sectionId
            });

            console.log(`Comment saved successfully for ${isCourseComment ? "course" : "section"}!`);

            // Update the comment count immediately
            const newCount = await this._getCommentsCount(courseId, sectionId);
            this.setState(prev => ({
                commentCounts: { ...prev.commentCounts, [courseId ?? sectionId!]: newCount },
                commentText: "",
                showCommentPopup: false
            }));

        } catch (error) {
            console.error("❌ Error saving comment:", error);
        }
    }

    private async _triggerShareFlow(): Promise<void> {
        try {
            this.setState({ isSharing: true });

            const flowUrl =
                "https://default4a936820d1e0422791030f8ff6abfb.77.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/48c902a7975b4915af10addfc9bb99e0/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QrOV9iYBMHy-IjdlDWuw9-F8xIDWqKPl13Ld1ImTZpg";

            const currentUser = await this._sp.web.currentUser();

            const body = {
                emails: this.state.selectedUsers.map((u) => u.email),
                sharedBy: currentUser.Title,
                courseName: this.state.selectedCourse?.Title || "קורס ללא שם",
                courseLink: this.state.selectedCourse?.Link || window.location.href
            };

            const response = await fetch(flowUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                this.setState({
                    showPeoplePickerPopup: false,
                    searchText: "",
                    selectedUsers: [],
                    filteredUsers: [],
                });
            } else {
                console.error("Flow failed:", await response.text());
                alert("❌ שגיאה בשליחה ל-Flow");
            }
        } catch (err) {
            console.error("Error triggering flow:", err);
            alert("⚠️ שגיאה לא צפויה בעת שליחת השיתוף");
        } finally {
            this.setState({ isSharing: false });
        }
    }




    public render(): React.ReactElement<{}> {
        const _items: any[] = this.state.items;
        const _sectionsItems: any[] = this.state.sectionsItems;
        const url: any = new URL(window.location.href);
        var _SectionID = parseInt(url.searchParams.get("SectionID") || "0", 10);

        return (
            <>
                <div className={styles.topSeperator}>
                    {/* <div style={{ margin: "0px auto", width: "1520px" }}> */}
                    <div className={styles.topSeperatorContainer}>
                        <div className={styles.right_courses}>
                            {_sectionsItems
                                .filter(item => item.ID === _SectionID)
                                .map((item, i) => (
                                    <div key={i}>{item.titleRight}</div>
                                ))}
                        </div>
                        <div className={styles.center_courses}>
                            {_sectionsItems
                                .filter(item => item.ID === _SectionID)
                                .map((item, i) => (
                                    <div key={i}>{item.titleLeft}</div>
                                ))}
                        </div>
                    </div>
                </div>

                <div className={styles.coursesSection}>
                    <div className={styles.inner}>
                        {_sectionsItems.some(item => item.ID === _SectionID) && (
                            _items
                                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                .map((Course, i) => (
                                    <div
                                        key={`c${i + 1}`}
                                        id={`c${i + 1}`}
                                        className={`${styles.oneCourse} ${Course.isSoldOut ? styles.soldOut : ''}`}
                                        style={{ backgroundImage: `url('${this._getHtml(Course.ID)}')`, order: Course.position ?? 0 }}
                                        onClick={() => this.handleCourseClick(Course)}
                                        >
                                        {Course.isSoldOut && (
                                            <div className={styles.soldOutBanner}></div>
                                        )}

                                        <div id={`d${i + 1}`} className={styles.courseName}>
                                            {Course.Title}
                                        </div>

                                        <div
                                            id={`e${i + 1}`}
                                            className={styles.courseContent}
                                            style={{ float: 'left', width: '100%', color: 'white', textAlign: 'center' }}
                                            dangerouslySetInnerHTML={{ __html: Course.innerText1 }}
                                        >
                                            {/* {Course.innerText1}<br />{Course.innerText2}  */}

                                        </div>

                                        <div id={`f${i + 1}`} className={styles.smallButton} onClick={(e) => e.stopPropagation()}>
                                            <div className={styles.actionButtons}>
                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.likeButton}`}
                                                        title="אהבתי"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // prevents navigating to the course
                                                            this._handleLikeClick(Course.ID, Course.Title, null);
                                                        }}
                                                    >
                                                        <i className="fas fa-heart"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getLikedUsers(Course.ID, null);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.likeCounts[Course.ID] ?? 0}
                                                    </span>
                                                </div>

                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.commentButton}`}
                                                        title="תגובות"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._openCommentPopup(Course.ID, null);
                                                        }}
                                                    >
                                                        <i className="fas fa-comment"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getCommentsList(Course.ID, null);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.commentCounts[Course.ID] ?? 0}
                                                    </span>

                                                </div>



                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.shareButton}`}
                                                        title="שתף"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            this.setState({
                                                                showPeoplePickerPopup: true,
                                                                selectedCourse: {
                                                                    Title: Course.Title,
                                                                    Link: Course.otherLink || window.location.href
                                                                },
                                                            });

                                                            // Fetch users only if not already loaded
                                                            if (this.state.allowedUsers.length === 0) {
                                                                await this._logGroupMembers();
                                                            }
                                                        }}

                                                    >
                                                        <i className="fas fa-share-alt"></i>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                ))
                        )}

                        {_sectionsItems.some(item => item.ID === _SectionID && item.isCategory === true) && (
                            _sectionsItems
                                .filter(Course => Course.fieldId === _SectionID)
                                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                .map((Course, i) => (
                                    <div
                                        key={`c${i + 1}`}
                                        id={`c${i + 1}`}
                                        className={styles.oneCourse}
                                        style={{ backgroundImage: `url('${Course.theImage.Url}')`, order: Course.position ?? 0 }}
                                        onClick={() => window.location.href = '/sites/Bmaster/SitePages/Courses.aspx?SectionID=' + Course.ID}
                                    // onMouseOver={() => this.handleMouseOver(i + 1)}
                                    // onMouseLeave={() => this.handleMouseLeave(i + 1)}
                                    >
                                        <div id={`d${i + 1}`} className={styles.courseName}>
                                            {Course.Title}
                                        </div>
                                        <div
                                            id={`e${i + 1}`}
                                            className={styles.courseContent}
                                            style={{ float: 'left', width: '100%', color: 'white', textAlign: 'center' }}
                                            dangerouslySetInnerHTML={{ __html: Course.addedText }}
                                        >
                                        </div>

                                        <div id={`f${i + 1}`} className={styles.smallButton} onClick={(e) => e.stopPropagation()}>
                                            <div className={styles.actionButtons}>
                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.likeButton}`}
                                                        title="אהבתי"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // prevents navigating to the course
                                                            this._handleLikeClick(null, Course.Title, Course.ID);
                                                        }}
                                                    >
                                                        <i className="fas fa-heart"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getLikedUsers(null, Course.ID);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.likeCounts[Course.ID] ?? 0}
                                                    </span>

                                                </div>

                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.commentButton}`}
                                                        title="תגובות"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._openCommentPopup(null, Course.ID);
                                                        }}
                                                    >
                                                        <i className="fas fa-comment"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getCommentsList(null, Course.ID);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.commentCounts[Course.ID] ?? 0}
                                                    </span>
                                                </div>



                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.shareButton}`}
                                                        title="Share"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            this.setState({
                                                                showPeoplePickerPopup: true,
                                                                selectedCourse: {
                                                                    Title: Course.Title,
                                                                    Link: `${window.location.origin}/sites/Bmaster/SitePages/Courses.aspx?SectionID=${Course.ID}` || window.location.href
                                                                },
                                                            });

                                                            // Fetch users only if not already loaded
                                                            if (this.state.allowedUsers.length === 0) {
                                                                await this._logGroupMembers();
                                                            }
                                                        }}

                                                    >
                                                        <i className="fas fa-share-alt"></i>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                        {this.state.showLikesPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>סימוני אהבתי</h3>
                                        <span className={styles.closeBtn} onClick={this._closeLikesPopup}>✖</span>
                                    </div>
                                    <div className={styles.popupContent}>
                                        {this.state.likedUsers.length > 0 ? (
                                            <ul>
                                                {this.state.likedUsers.map((name, index) => (
                                                    <li key={index}>
                                                        <strong>{name}</strong>
                                                    </li>
                                                ))}
                                            </ul>

                                        ) : (
                                            <p>ללא סימוני אהבתי</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {this.state.showCommentPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>תגובה חדשה</h3>
                                        <span className={styles.closeBtn} onClick={this._closeCommentPopup}>✖</span>
                                    </div>
                                    <div className={styles.popupContent}>
                                        <textarea
                                            className={styles.commentTextarea}
                                            placeholder="רשום תגובה..."
                                            value={this.state.commentText}
                                            onChange={this._handleCommentChange}
                                        ></textarea>
                                        <div className={styles.commentActions}>
                                            <button
                                                className={styles.commentBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    this._handleSendComment(this.state.activeCourseId, this.state.activeSectionId);
                                                }}
                                            >
                                                שלח
                                            </button>


                                            <button
                                                className={styles.commentCancelBtn}
                                                onClick={() =>
                                                    this.setState({
                                                        showPeoplePickerPopup: false,
                                                        searchText: "",
                                                        selectedUsers: [],
                                                        filteredUsers: this.state.allowedUsers
                                                    })
                                                }
                                            >
                                                ביטול
                                            </button>

                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {this.state.showCommentsPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>תגובות</h3>
                                        <span className={styles.closeBtn} onClick={this._closeCommentsPopup}>✖</span>
                                    </div>
                                    <div className={styles.popupContent}>
                                        {this.state.commentsList.length > 0 ? (
                                            <ul>
                                                {this.state.commentsList.map((c, index) => (
                                                    <li key={index}>
                                                        <strong>{c.author}:</strong> {c.text}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>אין תגובות</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {this.state.showPeoplePickerPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>בחר משתמשים לשיתוף</h3>
                                        <span
                                            className={styles.closeBtn}
                                            onClick={() =>
                                                this.setState({
                                                    showPeoplePickerPopup: false,
                                                    searchText: "",
                                                    selectedUsers: [],
                                                    filteredUsers: this.state.allowedUsers
                                                })
                                            }
                                        >
                                            ✖
                                        </span>
                                    </div>

                                    <div className={styles.popupContent}>
                                        {this.state.isLoadingUsers ? (
                                            <div className={styles.loadingContainer}>
                                                <i className="fas fa-spinner fa-spin"></i>
                                                <span>טוען משתמשים...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={styles.customPeoplePicker}>
                                                    <input
                                                        type="text"
                                                        className={styles.searchBox}
                                                        placeholder="חפש משתמש..."
                                                        value={this.state.searchText}
                                                        onChange={(e) => {
                                                            const text = e.target.value.toLowerCase();
                                                            const search = e.target.value.toLowerCase();

                                                            // Rank results by relevance
                                                            const filtered = this.state.allowedUsers
                                                                .filter(u =>
                                                                    u.text.toLowerCase().includes(search) ||
                                                                    (u.email && u.email.toLowerCase().includes(search))
                                                                )
                                                                .sort((a, b) => {
                                                                    const aName = a.text.toLowerCase();
                                                                    const bName = b.text.toLowerCase();

                                                                    // Exact match first
                                                                    if (aName === search && bName !== search) return -1;
                                                                    if (bName === search && aName !== search) return 1;

                                                                    // Starts with search term next
                                                                    const aStarts = aName.startsWith(search);
                                                                    const bStarts = bName.startsWith(search);
                                                                    if (aStarts && !bStarts) return -1;
                                                                    if (bStarts && !aStarts) return 1;

                                                                    // Otherwise normal alphabetical order (Hebrew-friendly)
                                                                    return a.text.localeCompare(b.text, 'he');
                                                                });

                                                            this.setState({ searchText: e.target.value, filteredUsers: filtered });

                                                        }}
                                                    />

                                                    {/* Suggestions */}
                                                    {this.state.searchText.trim() !== "" && this.state.filteredUsers.length > 0 && (
                                                        <ul className={styles.userList}>
                                                            {this.state.filteredUsers.slice(0, 15).map((u, i) => (
                                                                <li
                                                                    key={i}
                                                                    className={styles.userItem}
                                                                    onClick={() => {
                                                                        if (!this.state.selectedUsers.some(s => s.id === u.id)) {
                                                                            this.setState(prev => ({
                                                                                selectedUsers: [...prev.selectedUsers, u],
                                                                                searchText: ""
                                                                            }));
                                                                        }
                                                                    }}
                                                                >
                                                                    <strong>{u.text}</strong>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}



                                                    <div className={styles.selectedUsers}>
                                                        {this.state.selectedUsers.map((u, i) => (
                                                            <div
                                                                key={i}
                                                                className={styles.chip}
                                                                onClick={() =>
                                                                    this.setState((prev) => ({
                                                                        selectedUsers: prev.selectedUsers.filter((s) => s.id !== u.id),
                                                                    }))
                                                                }
                                                            >
                                                                {u.text} ✖
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className={styles.commentActions}>
                                                    <button
                                                        className={`${styles.commentBtn} ${this.state.selectedUsers.length === 0 ? styles.disabledButton : ""
                                                            }`}
                                                        disabled={this.state.isSharing || this.state.selectedUsers.length === 0}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!this.state.isSharing && this.state.selectedUsers.length > 0) {
                                                                await this._triggerShareFlow();
                                                            }
                                                        }}
                                                    >
                                                        {this.state.isSharing ? (
                                                            <>
                                                                <i className="fas fa-spinner fa-spin"></i> שולח...
                                                            </>
                                                        ) : (
                                                            "שתף"
                                                        )}
                                                    </button>



                                                    <button
                                                        className={styles.commentCancelBtn}
                                                        onClick={() =>
                                                            this.setState({
                                                                showPeoplePickerPopup: false,
                                                                searchText: "",
                                                                selectedUsers: [],
                                                                filteredUsers: this.state.allowedUsers,
                                                            })
                                                        }
                                                    >
                                                        ביטול
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                </div>
                            </div>
                        )}


                    </div>
                </div>
            </>
        );
    }

}