import * as React from 'react';
import styles from './OneCourse.module.scss';
//import type { IBmasterProps } from './IBmasterProps';
import { escape } from '@microsoft/sp-lodash-subset';
import { SPFI, spfi } from "@pnp/sp";
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
        // set initial state
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

        //this.handleCallShowHideModal = this.handleCallShowHideModal.bind(this);
        this._getItems();

    }


    private async _getItems() {

        const url: any = new URL(window.location.href);
        var _CourseID = url.searchParams.get("CourseID");
        const userEmail = await this._sp.web.currentUser();
        console.log("Current user email:", userEmail.Email);
        if (_CourseID) {
            // debugger;
            const itemsPhotos: ICoursesPhotos[] = await this._Utilities._getCoursesInfoPhotoByCourseID(_CourseID);
            this.setState({ itemsPhotos });
            console.table(itemsPhotos);

            const isCourseAvailable = await this._Utilities.areSeatsAvailableForAllActualCourses(_CourseID);
            console.log("isCourseAvailable: ", isCourseAvailable);
            this.setState({ isCourseAvailable });

            const _CourseSyllabusItem: ICourseSyllabus[] = await this._Utilities._getCourseSyllabusByCourseID(_CourseID);
            console.table(_CourseSyllabusItem);
            if (_CourseSyllabusItem.length > 0)
                this.setState({ SyllabusItem: _CourseSyllabusItem })

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

    private _getSyllabus() {
        const _SyllabusItem: ICourseSyllabus[] = this.state.SyllabusItem;
        if (_SyllabusItem.length > 0) {
            window.location.href = _SyllabusItem[0].FileRef;
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

    private async _deleteCalendarEvent(courseTitle: string): Promise<void> {
        try {
            console.log("Initializing MSGraphClient for deleting an event...");

            // Get the Graph client
            const graphClient = await this.props.context.msGraphClientFactory.getClient('3');
            const user = await graphClient.api('/me').get();
            const userEmail = user.mail;

            if (!graphClient) {
                console.error("MSGraphClient is not available.");
                return;
            }
            // Power Automate HTTP endpoint
            const flowUrl = "https://prod-21.westeurope.logic.azure.com:443/workflows/573b404827cf4a25baa45afa17391e39/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=B_TGUNqgM5dGJZ9P1pFwI-qSFRbQvP0jUccr3o6PSBI"


            // Prepare the body
            const requestBody = {
                email: userEmail,
                courseTitle: courseTitle
            };

            // Make the HTTP POST request to Power Automate
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


    private _goToCourseSign(_ItemID: any) {
        // debugger;
        let __OneCourseUrl = "/sites/Bmaster/SitePages/CourseSign.aspx?CourseID=";


        __OneCourseUrl += _ItemID;
        window.location.href = __OneCourseUrl;



    }

    public render(): React.ReactElement<{}> {
        // const {
        //   description,
        //   isDarkTheme,
        //   environmentMessage,
        //   hasTeamsContext,
        //   userDisplayName
        // } = this.props;


        const _itemsPhotos: ICoursesPhotos[] = this.state.itemsPhotos;
        const { canRegister } = this.state;
        const { userEmail } = this.state;
        const { isCourseAvailable } = this.state;





        return (
            <>
                {!this.state.isDataLoaded ? (
                    <div style={{ color: "white", textAlign: "center", padding: "20px" }}>
                        טוען נתונים...
                    </div>
                ) : (

                    <div className={styles.coursesSection}>

                        {_itemsPhotos.map((_item, i) =>

                            <div className={styles.inner}>
                                <div className={styles.left}>
                                    {/* <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/MAIN PIC empty.png" /> */}
                                    <img src={_item.FileRef} />
                                </div>
                                <div className={styles.right}>
                                    <div className={styles.title}>{_item.courseName.Title}</div>
                                    <div className={styles.text}
                                    dangerouslySetInnerHTML={{ __html: _item.description }}>
                                        {/* {_item.description} */}
                                    </div>
                                    <div className={styles.buttons}>
                                        <div className={styles.inner}>
                                            {_item.silabusButton && (
                                                <div className={styles.oneButton} onClick={() => this._getSyllabus()}>
                                                    לסילבוס הקורס - לחצו כאן &gt;
                                                </div>)}
                                            {_item.signButton && (
                                                <div>
                                                    {canRegister === "not_registered" && isCourseAvailable ? (
                                                        // Behavior when canRegister is "not_registered"
                                                        <div
                                                            className={styles.oneButton}
                                                            onClick={() => {
                                                                this._goToCourseSign(new URL(window.location.href).searchParams.get("CourseID"));
                                                            }}
                                                        >
                                                            לרישום לקורס - לחצו כאן &gt;
                                                        </div>
                                                    ) : canRegister === "registered_current_course" ? (
                                                        // Behavior when canRegister is "registered_current_course"
                                                        <>
                                                            {/* <div
                                                            className={styles.oneButton}
                                                            onClick={async () => {
                                                                try {
                                                                    // Call the deleteItem function with the desired item ID
                                                                    const registrationItemId = await this._Utilities.getRegistrationItemId(userEmail) as { id: number; practicalCourse: number };
                                                                    await this._Utilities.removeRegistrations(registrationItemId.id);
                                                                    await this._Utilities.subtractRegisterdNumber(registrationItemId.practicalCourse);
                                                                    await this._deleteCalendarEvent("קורס: " + _item.courseName.Title);


                                                                    // Redirect the user to the course sign-up page after deletion
                                                                    const courseId = new URL(window.location.href).searchParams.get("CourseID");
                                                                    this._goToCourseSign(courseId);
                                                                } catch (error) {
                                                                    console.error("Error deleting item:", error);
                                                                }
                                                            }}

                                                        >
                                                            עדכון הרשמה &gt;
                                                        </div> */}
                                                            <div
                                                                className={styles.oneButton}
                                                                onClick={async () => {
                                                                    try {
                                                                        const element = document.body;
                                                                        element.style.cursor = 'wait';
                                                                        const elements = document.querySelectorAll(`.${styles.oneButton}`);
                                                                        elements.forEach(el => (el as HTMLElement).style.cursor = 'wait');
                                                                        elements.forEach(el => (el as HTMLElement).style.pointerEvents = 'none');

                                                                        // Call the deleteItem function with the desired item ID
                                                                        const registrationItemId = await this._Utilities.getRegistrationItemId(userEmail) as { id: number; practicalCourse: number };
                                                                        await this._Utilities.removeRegistrations(registrationItemId.id);
                                                                        await this._Utilities.subtractRegisterdNumber(registrationItemId.practicalCourse);
                                                                        await this._deleteCalendarEvent(_item.courseName.Title);

                                                                        // Redirect the user after the item is deleted
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
                                                        // Behavior when canRegister is "registered_other_course"
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
                                                            {/* <div className={styles.noCourse}>ניצלת את זכותך לקורסים בשנה זו</div> */}
                                                            <span style={{ color: '#fff' }}>
                                                                {isCourseAvailable
                                                                    ? "ניצלת את זכותך לקורסים בשנה זו"
                                                                    : "הקורסים מלאים ואין מקומות פנויים כרגע"}
                                                            </span>
                                                        </>

                                                    )}
                                                </div>)}



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
