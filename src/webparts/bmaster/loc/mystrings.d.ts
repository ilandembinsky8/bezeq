declare interface IBmasterWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  DescriptionFieldLabel: string;
  AppLocalEnvironmentSharePoint: string;
  AppLocalEnvironmentTeams: string;
  AppLocalEnvironmentOffice: string;
  AppLocalEnvironmentOutlook: string;
  AppSharePointEnvironment: string;
  AppTeamsTabEnvironment: string;
  AppOfficeEnvironment: string;
  AppOutlookEnvironment: string;
  UnknownEnvironment: string;
  PageTypeFieldLabel:string;
  PhotoGallerySlideshowlblName:string;

  //Start - ListNames 
  //תחומים
  CourseSections:string;
  
  //גלריית תמונות סליידר
  PhotoGallerySlideshow:string;

  //קורסים
  CoursesListName:string;
  
  //תמונות קורסים
  CoursePhotosListName:string

  //סילבוס
  CourseSyllabusListName:string;

  //קורסים בפועל
  CourseActualListName:string;

    //רשומים לקורסים
    CourseRegistrationListName:string;

    //מחזורים
    CoursesMeetingsListName:string;


}

declare module 'BmasterWebPartStrings' {
  const strings: IBmasterWebPartStrings;
  export = strings;
}
