
import * as React from 'react';
import styles from './CourseSign.module.scss';
//import type { IBmasterProps } from './IBmasterProps';
import { escape } from '@microsoft/sp-lodash-subset';
import { SPFI, spfi } from "@pnp/sp";
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { Item, Items } from '@pnp/sp/items';
import { MSGraphClientFactory } from '@microsoft/sp-http';
import { MSGraphClientV3 } from '@microsoft/sp-http-msgraph';
import { GraphRequest } from '@microsoft/sp-http';



import { ICourseSections, ICoursesPhotos, ICoursesDates, ICourseSyllabus } from "../Interface/BmasterSPListInterface";

export interface ICourseSignProps {
    title?: string;
    context: WebPartContext;
}

export interface ICourseSignState {
    items: any[];
    itemsPhotos: ICoursesPhotos[];
    coursesPhotos: ICoursesPhotos[];
    displayedCourses: ICoursesPhotos[];
    itemsDates: ICoursesDates[];
    SyllabusItem: ICourseSyllabus[];
    canRegister: string;
    userEmail: string | null;
}


export default class CourseSign extends React.Component<ICourseSignProps, ICourseSignState, {}> {

    private _sp: SPFI;
    private _Utilities: Utilities;

    constructor(props: ICourseSignProps) {
        super(props);
        // set initial state
        this.state = {
            items: [],
            itemsPhotos: [],
            coursesPhotos: [],
            displayedCourses: [],
            itemsDates: [],
            SyllabusItem: [],
            canRegister: "not_registered",
            userEmail: null,
        };
        this._sp = getSP();
        this._Utilities = new Utilities();

        //this.handleCallShowHideModal = this.handleCallShowHideModal.bind(this);
        this._getItems();

    }

    private _goToOneCourse(_ItemID: any) {
        // debugger;
        let __OneCourseUrl = "/sites/Bmaster/SitePages/OneCourse.aspx?CourseID=";
        __OneCourseUrl += _ItemID;
        window.location.href = __OneCourseUrl;
    }


    private async _getItems() {

        const url: any = new URL(window.location.href);
        var _CourseID = url.searchParams.get("CourseID");
        const userEmail = await this._sp.web.currentUser();
        if (_CourseID) {
            // debugger;
            const canRegister = await this._Utilities._getIfUserCanRegister(userEmail.Email, _CourseID);
            if (canRegister == "registered_current_course" || canRegister == "registered_other_course") { window.location.href = "https://bezeq365.sharepoint.com/sites/Bmaster" };

            const coursesPhotos: ICoursesPhotos[] = await this._Utilities._getAllCoursesSmallPhoto();
            const displayedCourses = [...coursesPhotos]
                .filter(item => item.courseName?.otherLink?.trim())
                .sort(() => 0.5 - Math.random())
                .slice(0, 4);

            this.setState({ coursesPhotos, displayedCourses });

            const itemsPhotos: ICoursesPhotos[] = await this._Utilities._getCourseSignInfoPhotoByCourseID(_CourseID);
            this.setState({ itemsPhotos });
            console.table(itemsPhotos);

            const itemsDates: ICoursesDates[] = await this._Utilities._getCourseSignOptionsByCourseID(_CourseID);
            this.setState({ itemsDates });
            console.log("items Dates: ", itemsDates);


            const _CourseSyllabusItem: ICourseSyllabus[] = await this._Utilities._getCourseSyllabusByCourseID(_CourseID);
            console.table(_CourseSyllabusItem);
            if (_CourseSyllabusItem.length > 0)
                this.setState({ SyllabusItem: _CourseSyllabusItem })

        }

    }

    private _getSyllabus() {
        const _SyllabusItem: ICourseSyllabus[] = this.state.SyllabusItem;
        if (_SyllabusItem.length > 0) {
            window.location.href = _SyllabusItem[0].FileRef;
        }


    }

    private async _createCalendarEvent(courseTitle: string, startDate: Date, finishDate: Date, location?: string, ID?: number): Promise<void> {
        try {
            console.log('Preparing to trigger Power Automate flow...');

            // Get user's email and name using MSGraphClient
            const graphClient = await this.props.context.msGraphClientFactory.getClient('3');
            const user = await graphClient.api('/me').get();
            const userEmail = user.mail;
            const userName = user.displayName;

            if (!userEmail || !userName) {
                console.error('User info not found.');
                return;
            }

            // Power Automate HTTP endpoint
            const flowUrl = "https://default4a936820d1e0422791030f8ff6abfb.77.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6f6af5008ad248eda67f5f27c53926ae/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=hFWArT3AkEjKzYw53ufw08RXRMG9nn5nsZLRn1PdenE";

            // Prepare the body
            const requestBody: any = {
                courseTitle: courseTitle,
                startDate: startDate.toISOString(),
                endDate: finishDate.toISOString(),
                attendeeEmail: userEmail,
                attendeeName: userName,
                ID: ID
            };

            if (location?.trim()) {
                requestBody.location = location.trim();
            }

            // Make the HTTP POST request to Power Automate
            const response = await fetch(flowUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Flow call failed with status ${response.status}`);
            }

            console.log("✅ Calendar event created successfully for:", userEmail);

        } catch (error) {
            console.error("❌ Error creating calendar event:", error);
        }
    }






    private _goToOneCourseThanks(_ItemID: any) {
        // debugger;
        let __OneCourseThanksUrl = "/sites/Bmaster/SitePages/OneCourseThanks.aspx?ActualCourseID=";
        __OneCourseThanksUrl += _ItemID;
        window.location.href = __OneCourseThanksUrl;
    }





    public render(): React.ReactElement<{}> {
        console.log("Rendering CourseSign");
        // const {
        //   description,
        //   isDarkTheme,
        //   environmentMessage,
        //   hasTeamsContext,
        //   userDisplayName
        // } = this.props;


        const _itemsPhotos: ICoursesPhotos[] = this.state.itemsPhotos;
        const _coursesPhotos: ICoursesPhotos[] = this.state.coursesPhotos;
        const _itemsDates: ICoursesDates[] = this.state.itemsDates;
        console.log('_coursesPhotos:', _coursesPhotos);
        console.log('itemsDates:', _itemsDates);





        return (
            <>
                {/*         
            <div className={styles.CourseSign}>
                <div className={styles.inner}>
                    
                    
                    {_items.map((_item,i) => 

                    // <div id={"s"+i} className={styles.oneItem} style={{backgroundImage:"url('"+  _item.theImage.Url  +"')"}}  onClick={() => window.location.href ='/sites/Bmaster/SitePages/Courses.aspx?SectionID=' + _item.ID }>
                    //     <div className={styles.text}>{_item.Title}</div>
                    // </div>


  

                    <div id="c1" className={styles.CourseSign} style={{backgroundImage:"url('"+this._getHtml(_item.ID)+"')"}} >
                        <div id="d1" className={styles.courseName}>{_item.Title}</div>
                        <div id="e1" style={{float:'left',width:'60%',height:'110px',color:'white',display:'none'}}>aaaaa<br/>bbbbb</div>
                        <div className={styles.smallButton}>
                            לפרטים ולרישום לחץ כאן
                        </div>
                    </div>

                    )}                    
                    
             
                </div>
            </div>              */}




                <div className={styles.coursesSection}>
                    <div className={styles.rightRegister}>
                        <div className={styles.mainPic}>
                            {this.state.itemsPhotos.length > 0 && (
                                <img src={this.state.itemsPhotos[0].FileRef} className={styles.max} />
                            )}
                        </div>
                        <div className={styles.sil_chairs}>
                            {/* <div className={styles.silabus} onClick={() => this._getSyllabus()}>לסילבוס</div> */}
                            <div className={styles.showChairs}>
                                <div className={styles.r100}>
                                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/chair.png" className={styles.max} alt="Chair" />
                                </div>
                                <div className={styles.title}>
                                    מספר המקומות הולך ואוזל
                                </div>
                                <div className={styles.subTitle}>
                                    מהרו להירשם
                                </div>
                            </div>

                        </div>
                    </div>


                    <div className={styles.leftRegister}>
                        <div className={styles.r100}>
                            {_itemsDates.map((_item, i) =>
                                <div
                                    className={styles.register}
                                    onClick={async () => {
                                        // spinner cursor and blocking button after pressing once
                                        const element = document.body;
                                        element.style.cursor = 'wait';
                                        const elements = document.querySelectorAll(`.${styles.register}`);
                                        elements.forEach(el => (el as HTMLElement).style.cursor = 'wait');
                                        elements.forEach(el => (el as HTMLElement).style.pointerEvents = 'none');

                                        await this._Utilities.registerUser(_item.courseName.ID, _item.ID); // Call to register the user
                                        await this._Utilities.addRegisterdNumber(_item.ID); // Increment currentListed for the item

                                        if (_item.meetings && _item.meetings.length > 0) {
                                            await Promise.all(
                                                _item.meetings.map(async (meeting) => {
                                                    await this._createCalendarEvent(
                                                        _item.courseName.Title,
                                                        new Date(meeting.startDate),
                                                        new Date(meeting.finishDate),
                                                        meeting.location,
                                                        meeting.ID,

                                                    );
                                                })
                                            );
                                        } else {
                                            // Fallback if no meetings found - create one event for the course itself
                                            await this._createCalendarEvent(
                                                _item.courseName.Title,
                                                new Date(_item.startDate),
                                                new Date(_item.finishDate),
                                                _item.location
                                            );
                                        }
                                        this._goToOneCourseThanks(_item.ID); // Navigate after all calls complete
                                    }}
                                >
                                    <div className={styles.internal}>
                                        <div className={styles.title}>{_item.courseName.Title}</div>
                                        <div className={styles.date}>
                                            {_item.meetings.length === 0 ? 1 : _item.meetings.length} מפגשים
                                            {/* {new Date(_item.startDate).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }).replace(',', '').replace('.', "/").replace('יום ', "")} */}
                                        </div>
                                        <div className={styles.hour}>
                                            תאריך פתיחה: {new Date(_item.startDate)
                                                .toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                .replace(/\./g, '/')}



                                            {/* {`${new Date(_item.startDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}-${new Date(_item.finishDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`} */}
                                        </div>
                                        <div className={styles.participants}>
                                            <div className={styles.total}>{_item.maxListed}</div>
                                            <div className={styles.area}>
                                                <div className={styles.filled}></div>
                                            </div>
                                            <div className={styles.listed}>{_item.currentListed}</div>
                                            <div className={styles.toRegister}>
                                                להרשמה <span style={{ fontSize: '15px' }}>⮜</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* <div className={styles.doIt}>להרשמה</div> */}
                                </div>)}
                        </div>
                        <div className={styles.internal} style={{ float: 'right', width: '100%', textAlign: 'left', marginTop: "50px" }}>

                        </div>
                        <div className={styles.bottomRegister}>
                            {console.log('_coursesPhotos:', _coursesPhotos)}
                            <div className={styles.overLine}>
                                <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/line.png" className={styles.max} alt="Line" />
                                <div className={styles.title}>תכנים נוספים שעשויים לעניין אותך</div>
                            </div>
                            <div className={styles.courses}>
                                {this.state.displayedCourses.map((_item, i) => (
                                    <div className={styles.anotherCourse} key={i} onClick={() => window.open(_item.courseName.otherLink, '_blank')}>
                                        <div className={styles.pic}>
                                            <img
                                                src={_item.FileRef}
                                                className={styles.max}
                                                alt={_item.courseName.Title}
                                            />
                                        </div>
                                        <div className={styles.theName}>{_item.courseName.Title}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>


                </div>


            </>


        );
    }
}