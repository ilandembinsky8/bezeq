import * as React from 'react';
import styles from './OneCourse.module.scss';
//import type { IBmasterProps } from './IBmasterProps';
import { escape } from '@microsoft/sp-lodash-subset';
import { SPFI } from "@pnp/sp";
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { Item, Items } from '@pnp/sp/items';
import "@pnp/sp/webs";
import "@pnp/sp/site-users/web";

import { ICourseSections, ICoursesPhotos, ICourseSyllabus } from "../Interface/BmasterSPListInterface";
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IOneCourseProps {
  title?: string;
  context: WebPartContext;
}

export interface IOneCourseState {
  items: any[];
  itemsPhotos: ICoursesPhotos[];
  SyllabusItem: ICourseSyllabus[];
  canRegister: string;
  isCourseAvailable: boolean;
  userEmail: string | null;
  isDataLoaded: boolean;
}

export default class OneCourse extends React.Component<IOneCourseProps, IOneCourseState, {}> {

  private _sp: SPFI;
  private _Utilities: Utilities;

  constructor(props: IOneCourseProps) {
    super(props);
    this.state = {
      items: [],
      itemsPhotos: [],
      SyllabusItem: [],
      canRegister: "not_registered",
      isCourseAvailable: true,
      userEmail: null,
      isDataLoaded: false,
    };
    this._sp = getSP();
    this._Utilities = new Utilities();

    this._getItems();
  }

  private async _getItems() {
    const url: any = new URL(window.location.href);
    const _CourseID = url.searchParams.get("CourseID");
    const userEmail = await this._sp.web.currentUser();
    console.log("Current user email:", userEmail.Email);

    if (_CourseID) {
      const itemsPhotos: ICoursesPhotos[] = await this._Utilities._getCoursesInfoPhotoByCourseID(_CourseID);
      this.setState({ itemsPhotos });
      console.table(itemsPhotos);

      const isCourseAvailable = await this._Utilities.areSeatsAvailableForAllActualCourses(_CourseID);
      console.log("isCourseAvailable: ", isCourseAvailable);
      this.setState({ isCourseAvailable });

      const _CourseSyllabusItem: ICourseSyllabus[] = await this._Utilities._getCourseSyllabusByCourseID(_CourseID);
      console.table(_CourseSyllabusItem);
      if (_CourseSyllabusItem.length > 0) {
        this.setState({ SyllabusItem: _CourseSyllabusItem });
      }

      try {
        const canRegister = await this._Utilities._getIfUserCanRegister(userEmail.Email, _CourseID);
        console.log("can register ?", canRegister);
        this.setState({ canRegister, userEmail: userEmail.Email });
      } catch (error) {
        console.error("Error in _getIfUserCanRegister:", error);
      }

      this.setState({ isDataLoaded: true });
    }
  }

  private _getHtml(_ItemID: any) {
    let _htmlJSX = null;
    if (this.state.itemsPhotos.length > 0) {
      const itemsPhotos: ICoursesPhotos[] = this.state.itemsPhotos;
      const _fileURl = itemsPhotos.filter(item => item.courseName.ID === _ItemID);
      if (_fileURl.length > 0) {
        _htmlJSX = _fileURl[0].FileRef;
      }
    }
    return _htmlJSX;
  }

  // ===== עזר – הוצאת ת"ז מה־login =====
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

  /**
   * רישום סטטיסטיקה ל-BezeqStatistics אם ה-URL *אינו* דף קורס (OneCourse / Courses)
   */
  private async logNavigationIfNonCourse(targetUrl: string, courseId: number | null, courseTitle: string): Promise<void> {
    try {
      if (!targetUrl) return;

      const lower = targetUrl.toLowerCase();

      // אם זה דף קורס (OneCourse/Courses) – לא סופרים כאן, זה מתבצע ע"י BPageCount
      if (lower.indexOf('onecourse.aspx') !== -1 || lower.indexOf('courses.aspx') !== -1) {
        return;
      }

      const user = this.props.context.pageContext.user;
      const userName: string = user.displayName || '';
      const loginName: string = user.loginName || '';

      const tzFromClaims = this.extractTeudatZehutFromClaims(loginName);
      const teudatZehut = tzFromClaims || this.extractTeudatZehutFromUpn(loginName);

      let absoluteUrl: string;
      if (targetUrl.indexOf('http://') === 0 || targetUrl.indexOf('https://') === 0) {
        absoluteUrl = targetUrl;
      } else {
        // אם זה path יחסי
        const needsSlash = targetUrl.charAt(0) !== '/';
        absoluteUrl = window.location.origin + (needsSlash ? '/' : '') + targetUrl;
      }

      await this._sp.web.lists.getByTitle('BezeqStatistics').items.add({
        Title: courseTitle || 'ניווט קורס',
        PageType: 'קורס',
        UserNameText: userName,
        Link: absoluteUrl,
        PageID: courseId ? String(courseId) : '',
        Tas: teudatZehut || ''
      });

    } catch (error) {
      console.error('❌ Error logging navigation:', error);
    }
  }

  // פתיחת סילבוס – עם ספירת כניסה אם זה לא דף קורס
  private async _getSyllabus(): Promise<void> {
    const _SyllabusItem: ICourseSyllabus[] = this.state.SyllabusItem;
    if (_SyllabusItem.length > 0) {
      const targetUrl = _SyllabusItem[0].FileRef;

      const urlObj = new URL(window.location.href);
      const courseIdStr = urlObj.searchParams.get("CourseID");
      const courseId = courseIdStr ? parseInt(courseIdStr, 10) : null;

      const courseTitle: string =
        (_SyllabusItem[0] as any).courseName?.Title ||
        (this.state.itemsPhotos[0]?.courseName?.Title ?? '');

      await this.logNavigationIfNonCourse(targetUrl, courseId, courseTitle);
      window.location.href = targetUrl;
    }
  }

  private async _deleteCalendarEvent(courseTitle: string): Promise<void> {
    try {
      console.log("Initializing MSGraphClient for deleting an event...");

      const graphClient = await this.props.context.msGraphClientFactory.getClient('3');
      const user = await graphClient.api('/me').get();
      const userEmail = user.mail;

      if (!graphClient) {
        console.error("MSGraphClient is not available.");
        return;
      }

      const flowUrl = "https://default4a936820d1e0422791030f8ff6abfb.77.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/573b404827cf4a25baa45afa17391e39/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=91voLSpm75XXrwSuiGeJKHx8BPeHHAivATJ54PhnGdg";

      const requestBody = {
        email: userEmail,
        courseTitle: courseTitle
      };

      const response = await fetch(flowUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

    } catch (error) {
      console.error("Error deleting calendar event:", error);
    }
  }

  // ניווט לדף רישום – גם כאן נספור אם זה לא דף קורס סטנדרטי
  private async _goToCourseSign(_ItemID: any): Promise<void> {
    let __OneCourseUrl = "/sites/Bmaster/SitePages/CourseSign.aspx?CourseID=" + _ItemID;

    const urlObj = new URL(window.location.href);
    const courseIdStr = urlObj.searchParams.get("CourseID");
    const courseId = courseIdStr ? parseInt(courseIdStr, 10) : null;

    const courseTitle: string =
      this.state.itemsPhotos[0]?.courseName?.Title ??
      '';

    await this.logNavigationIfNonCourse(__OneCourseUrl, courseId, courseTitle);
    window.location.href = __OneCourseUrl;
  }

  public render(): React.ReactElement<{}> {
    const _itemsPhotos: ICoursesPhotos[] = this.state.itemsPhotos;
    const { canRegister, userEmail, isCourseAvailable } = this.state;

    return (
      <>
        {!this.state.isDataLoaded ? (
          <div style={{ color: "white", textAlign: "center", padding: "20px" }}>
            טוען נתונים...
          </div>
        ) : (
          <div className={styles.coursesSection}>
            {_itemsPhotos.map((_item, i) =>
              <div className={styles.inner} key={i}>
                <div className={styles.left}>
                  <img src={_item.FileRef} />
                </div>
                <div className={styles.right}>
                  <div className={styles.title}>{_item.courseName.Title}</div>
                  <div
                    className={styles.text}
                    dangerouslySetInnerHTML={{ __html: _item.description }}>
                  </div>
                  <div className={styles.buttons}>
                    <div className={styles.inner}>
                      {_item.silabusButton && (
                        <div
                          className={styles.oneButton}
                          onClick={() => this._getSyllabus()}>
                          לסילבוס הקורס - לחצו כאן &gt;
                        </div>
                      )}
                      {_item.signButton && (
                        <div>
                          {canRegister === "not_registered" && isCourseAvailable ? (
                            <div
                              className={styles.oneButton}
                              onClick={() => {
                                this._goToCourseSign(new URL(window.location.href).searchParams.get("CourseID"));
                              }}
                            >
                              לרישום לקורס - לחצו כאן &gt;
                            </div>
                          ) : canRegister === "registered_current_course" ? (
                            <>
                              <div
                                className={styles.oneButton}
                                onClick={async () => {
                                  try {
                                    const element = document.body;
                                    element.style.cursor = 'wait';
                                    const elements = document.querySelectorAll(`.${styles.oneButton}`);
                                    elements.forEach(el => (el as HTMLElement).style.cursor = 'wait');
                                    elements.forEach(el => (el as HTMLElement).style.pointerEvents = 'none');

                                    const registrationItemId = await this._Utilities.getRegistrationItemId(userEmail) as { id: number; practicalCourse: number };
                                    await this._Utilities.removeRegistrations(registrationItemId.id);
                                    await this._Utilities.subtractRegisterdNumber(registrationItemId.practicalCourse);
                                    await this._deleteCalendarEvent(_item.courseName.Title);

                                    window.location.reload();
                                  } catch (error) {
                                    console.error("Error deleting item:", error);
                                  }
                                }}
                              >
                                ביטול הרשמה &gt;
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                className={`${styles.oneButton} ${styles.disabledButton}`}
                                style={{
                                  opacity: 0.5,
                                  pointerEvents: "none",
                                }}
                              >
                                לרישום לקורס - לחצו כאן &gt;
                              </div>
                              <span style={{ color: '#fff' }}>
                                {isCourseAvailable
                                  ? "ניצלת את זכותך לקורסים בשנה זו"
                                  : "הקורסים מלאים ואין מקומות פנויים כרגע"}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }
}
