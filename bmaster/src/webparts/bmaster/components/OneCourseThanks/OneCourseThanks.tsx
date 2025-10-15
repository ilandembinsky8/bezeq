import * as React from 'react';
import styles from './OneCourseThanks.module.scss';
import { SPFI } from '@pnp/sp';
import { Utilities } from '../Utilities/Utilities';
import { getSP } from '../../PNPConfig/pnpjsConfig';
import { ICoursesDates, ICoursesPhotos } from '../Interface/BmasterSPListInterface';

export interface IOneCourseThanksProps {
    title?: string;
}

export interface IOneCourseThanksState {
    ActualCourse: ICoursesDates[]; // Store course data
    itemsPhotos: ICoursesPhotos[]; // Store photo data
}

export default class OneCourseThanks extends React.Component<IOneCourseThanksProps, IOneCourseThanksState> {
    private _sp: SPFI;
    private _Utilities: Utilities;

    constructor(props: IOneCourseThanksProps) {
        super(props);
        this.state = {
            ActualCourse: [],
            itemsPhotos: [],
        };
        this._sp = getSP();
        this._Utilities = new Utilities();
    }

    componentDidMount() {
        this._getItems();
    }

    private async _getItems() {
        try {
            const url = new URL(window.location.href);
            const _CourseID = url.searchParams.get('ActualCourseID');
            console.log('Extracted ActualCourseID:', _CourseID);

            if (_CourseID) {
                // Fetch ActualCourse
                const ActualCourse: ICoursesDates[] = await this._Utilities._getActualCourseByActualCourseID(_CourseID);
                if (ActualCourse.length > 0) {
                    console.log('Fetched ActualCourse:', ActualCourse);
                    this.setState({ ActualCourse });

                    // Fetch itemsPhotos using ActualCourse[0].courseName.ID
                    const courseID = ActualCourse[0].courseName?.ID;
                    if (courseID) {
                        const itemsPhotos: ICoursesPhotos[] = await this._Utilities._getCourseSignInfoPhotoByCourseID(courseID.toString());

                        console.log('Fetched itemsPhotos:', itemsPhotos);
                        this.setState({ itemsPhotos });
                    } else {
                        console.warn('No CourseID found in ActualCourse[0]');
                    }
                } else {
                    console.warn('No data found for ActualCourseID:', _CourseID);
                }
            } else {
                console.error('ActualCourseID not provided in URL.');
            }
        } catch (error) {
            console.error('Error fetching course data or photos:', error);
        }
    }

    public render(): React.ReactElement<{}> {
        const _ActualCourse: ICoursesDates[] = this.state.ActualCourse;
        const _itemsPhotos: ICoursesPhotos[] = this.state.itemsPhotos;

        const hasCourseData = _ActualCourse && _ActualCourse.length > 0;
        const hasPhotoData = _itemsPhotos && _itemsPhotos.length > 0;

        const imageUrl = hasPhotoData ? _itemsPhotos[0].FileRef : 'cut/MAIN PIC1.png';
        const courseID = hasCourseData ? _ActualCourse[0].ID : 'ID not available';

        const courseDate = hasCourseData
            ? new Date(_ActualCourse[0].startDate).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }).replace(',', '').replace('.', "/").replace('יום ',"")
            : 'Date not available';

        const courseTime = hasCourseData
            ? `${new Date(_ActualCourse[0].startDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}-${new Date(_ActualCourse[0].finishDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
            : 'Time not available';

        return (
            <div className={styles.coursesSection}>
                <div className={styles.innerThanks}>
                    <div className={styles.r100}>
                        <img src={imageUrl}/>
                    </div>
                    <div className={styles.thanksLine}>{_itemsPhotos?.[0]?.courseName?.Title || 'No Title Available'}</div>
                    <div className={styles.saveTheDay}></div>
                    <div className={styles.thanksText}>
                    <div className={styles.thanksMessage}>
                        תודה שנרשמת
                    </div>
                    <div className={styles.thanksDate}>
                        {courseDate} | <span style={{ direction: 'ltr', display: 'inline-block' }}>{courseTime}</span>
                    </div></div>
                </div>
            </div>
        );
    }
}
