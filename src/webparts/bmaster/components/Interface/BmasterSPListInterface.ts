

export interface ISPLookUp {
  ID: number;
  Title: string;
  otherLink?: string;
}

export interface IUrlImageFieldSP {
  Description: string;
  Url: string;
}

export interface ICourseSections {
  ID: number;
  Title: string;
  theImage: IUrlImageFieldSP;
  addedText: string;
  fieldId: string;
  position: number;
}

export interface IGalleryItem {
  image: string;
  line1: string;
  line2: string;
  line3: string;
  freeText: string;
}

export interface ICoursesPhotos {
  ID: number;
  FileRef: string;
  courseName: ISPLookUp;
  description: string;
  silabusButton: boolean;
  signButton: boolean;
}

export interface Imeeting {
  startDate: string;
  finishDate: string;
  location?: string;
  ID: number;
}

export interface ICoursesDates {
  ID: number;
  FileRef: string;
  courseName: ISPLookUp;
  finishDate: string;
  startDate: string;
  currentListed: number;
  maxListed: number;
  location?: string;
  meetings: Imeeting[];
}





export interface ICourseSyllabus {
  FileRef: string;
  CourseName: ISPLookUp;
}



