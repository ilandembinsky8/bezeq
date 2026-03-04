import * as React from 'react';
import styles from './ManagerPage.module.scss';
import { SPFI, spfi } from "@pnp/sp";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { Utilities } from "../Utilities/Utilities";

// FlatPicker
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Hebrew } from "flatpickr/dist/l10n/he";


interface IMeeting {
    ID: number;
    startDate: string;
    endDate: string;
    location: string;
}

interface ICourse {
    ID: number;
    courseId: number;
    title: string;
    meetings: IMeeting[];
    startDate: string;
    finishDate: string;
}

export interface IManagerPageProps {
    context: any;
}

export interface IManagerPageState {

    // Shared data
    courses: ICourse[];
    allowedUsers: any[];
    isLoadingUsers: boolean;

    // Form #1 – Update Meeting
    selectedCourseId: number | null;
    selectedMeetingId: number | null;
    startDate: string;
    endDate: string;
    location: string;

    // Form #2 – Register User
    searchText: string;
    filteredUsers: any[];
    selectedUsers: any[];
    registerUser: any | null;
    registerCourseId: number | null;
    selectedRegisterCourseId: number | null;

    // Form #3 – Cancel Registration
    cancelUser: any | null;
    cancelCoursesForUser: any[];
    cancelSelectedCourse: any | null;
    cancelUsersFromList: any[];
    cancelSearchText: string;
    filteredCancelUsers: any[]

}

export default class ManagerPage extends React.Component<IManagerPageProps, IManagerPageState> {
    // FlatPicker Variables
    private startDateRef = React.createRef<HTMLInputElement>();
    private endDateRef = React.createRef<HTMLInputElement>();

    private sp: SPFI;
    private _Utilities: Utilities;
    private CourseActualListName = "מחזורים";
    private CoursesMeetingsListName = "מפגשים";

    // Constructor
    constructor(props: IManagerPageProps) {
        super(props);

        this.sp = getSP();
        this._Utilities = new Utilities();

        this.state = {

            // Shared
            courses: [],
            allowedUsers: [],
            isLoadingUsers: false,

            // Form #1 – Update Meeting
            selectedCourseId: null,
            selectedMeetingId: null,
            startDate: '',
            endDate: '',
            location: '',

            // Form #2 – Register User
            searchText: '',
            filteredUsers: [],
            selectedUsers: [],
            registerUser: null,
            registerCourseId: null,
            selectedRegisterCourseId: null,

            // Form #3 – Cancel Registration
            cancelUser: null,
            cancelCoursesForUser: [],
            cancelSelectedCourse: null,
            cancelUsersFromList: [],
            cancelSearchText: '',
            filteredCancelUsers: [],
        };
    }

    // Shared Functions
    private fromDateTimeLocal(value: string): string {
        if (!value) return value;
        return new Date(value).toISOString();
    }

    private formatDateTime(value: string): string {
        if (!value) return '';

        const d = new Date(value);
        const pad = (n: number) => (n < 10 ? '0' + n : n.toString());

        return (
            pad(d.getDate()) + '/' +
            pad(d.getMonth() + 1) + '/' +
            d.getFullYear() + ' ' +
            pad(d.getHours()) + ':' +
            pad(d.getMinutes())
        );
    }

    private initFlatpickr() {
        if (this.startDateRef.current) {
            flatpickr(this.startDateRef.current, {
                enableTime: true,
                noCalendar: false,        // ✅ no diary popup
                time_24hr: true,         // ✅ 24H
                dateFormat: "d/m/Y H:i", // ✅ DD/MM/YYYY
                locale: Hebrew,
                defaultDate: this.state.startDate
                    ? new Date(this.state.startDate)
                    : undefined,
                onChange: (dates) => {
                    if (dates[0]) {
                        this.setState({ startDate: dates[0].toISOString() });
                    }
                }
            });
        }

        if (this.endDateRef.current) {
            flatpickr(this.endDateRef.current, {
                enableTime: true,
                noCalendar: false,
                time_24hr: true,
                dateFormat: "d/m/Y H:i",
                locale: Hebrew,
                defaultDate: this.state.endDate
                    ? new Date(this.state.endDate)
                    : undefined,
                onChange: (dates) => {
                    if (dates[0]) {
                        this.setState({ endDate: dates[0].toISOString() });
                    }
                }
            });
        }
    }


    // Lifecycle
    public async componentDidMount() {
        await this.loadCourses();
        await this.loadAllowedUsers();
        await this.loadCancelUsers();
    }


    // Shared Data Loading
    private async loadCourses() {
        try {
            const items = await this.sp.web.lists
                .getByTitle(this.CourseActualListName)
                .items
                .select("ID", "courseName/Title", "courseName/ID", "startDate", "finishDate")
                .expand("courseName")();

            const courses: ICourse[] = [];

            for (let i = 0; i < items.length; i++) {
                courses.push({
                    ID: items[i].ID,                    // מחזור ID
                    title: items[i].courseName.Title,   // שם הקורס
                    courseId: items[i].courseName.ID,        // קורס אב
                    startDate: items[i].startDate,      // תאריך מחזור
                    meetings: [],
                    finishDate: items[i].finishDate,
                });
            }
            courses.sort(
                (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
            );

            this.setState({ courses });
        } catch (err) {
            console.error("Failed loading courses", err);
        }
    }

    private async loadAllowedUsers(): Promise<void> {
        try {
            this.setState({ isLoadingUsers: true });

            const users = await this.sp.web.siteUsers();

            const formatted = users.map(u => ({
                id: u.Id,
                text: u.Title,
                email: u.Email
            }));

            this.setState({
                allowedUsers: formatted,
                filteredUsers: formatted,
                isLoadingUsers: false
            });
        } catch (err) {
            console.error("Failed loading users", err);
            this.setState({ isLoadingUsers: false });
        }
    }


    // Form #1 – Update Meeting
    private async loadMeetings(courseId: number) {
        try {
            const items = await this.sp.web.lists
                .getByTitle(this.CoursesMeetingsListName)
                .items
                .select("ID", "startDate", "endDate", "location", "actualCourse/ID")
                .expand("actualCourse")
                .filter(`actualCourse/ID eq ${courseId}`)();

            const meetings: IMeeting[] = [];

            for (let i = 0; i < items.length; i++) {
                meetings.push({
                    ID: items[i].ID,
                    startDate: items[i].startDate,
                    endDate: items[i].endDate,
                    location: items[i].location
                });
            }

            // sort by start date
            meetings.sort((a, b) =>
                new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            );


            const courses = this.state.courses.slice();

            for (let i = 0; i < courses.length; i++) {
                if (courses[i].ID === courseId) {
                    courses[i].meetings = meetings;
                    break;
                }
            }

            this.setState({ courses });
        } catch (err) {
            console.error("Failed loading meetings", err);
        }
    }

    private onCourseChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const courseId = Number(e.target.value);

        this.setState({
            selectedCourseId: courseId,
            selectedMeetingId: null,
            startDate: '',
            endDate: '',
            location: ''
        });

        await this.loadMeetings(courseId);
    };

    private onMeetingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const meetingId = Number(e.target.value);

        let meeting: IMeeting | null = null;

        const courses = this.state.courses;
        for (let i = 0; i < courses.length; i++) {
            if (courses[i].ID === this.state.selectedCourseId) {
                const meetings = courses[i].meetings;
                for (let j = 0; j < meetings.length; j++) {
                    if (meetings[j].ID === meetingId) {
                        meeting = meetings[j];
                        break;
                    }
                }
            }
        }

        this.setState(
            {
                selectedMeetingId: meetingId,
                startDate: meeting ? meeting.startDate : '',
                endDate: meeting ? meeting.endDate : '',
                location: meeting ? meeting.location : ''
            },
            () => this.initFlatpickr()
        );


    };

    private onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const {
            selectedCourseId,
            selectedMeetingId,
            startDate,
            endDate,
            location
        } = this.state;

        if (!selectedMeetingId || !selectedCourseId) {
            console.warn("Missing selection");
            return;
        }

        try {
            await this.sp.web.lists
                .getByTitle(this.CoursesMeetingsListName)
                .items
                .getById(selectedMeetingId)
                .update({
                    startDate: this.fromDateTimeLocal(startDate),
                    endDate: this.fromDateTimeLocal(endDate),
                    location
                });

            // refresh meetings so dropdown shows updated data
            await this.loadMeetings(selectedCourseId);

            // reset UI
            this.resetUpdateMeetingForm();

            alert("המפגש עודכן בהצלחה");


        } catch (err) {
            console.error("Failed updating meeting", err);
            alert("שגיאה בעדכון המפגש");
        }
    };

    private resetUpdateMeetingForm = () => {
        this.setState({
            selectedCourseId: null,
            selectedMeetingId: null,
            startDate: '',
            endDate: '',
            location: ''
        });

        // Clear flatpickr inputs
        if (this.startDateRef.current) {
            this.startDateRef.current.value = '';
        }

        if (this.endDateRef.current) {
            this.endDateRef.current.value = '';
        }
    };



    // Form #2 – Register User to Course
    private onRegisterUserSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        const search = text.toLowerCase();

        const filtered = this.state.allowedUsers.filter(u =>
            u.text.toLowerCase().includes(search) ||
            (u.email && u.email.toLowerCase().includes(search))
        );

        this.setState({
            searchText: text,
            filteredUsers: filtered,
            registerUser: null // 🔥 invalidate selection when typing
        });
    };

    private onRegisterUserToCourse = async (e: React.FormEvent) => {
        e.preventDefault();

        const { registerCourseId, courses } = this.state;

        if (!registerCourseId) {
            alert("יש לבחור קורס");
            return;
        }

        let selectedCourse: any = null;

        for (let i = 0; i < courses.length; i++) {
            if (courses[i].ID === registerCourseId) {
                selectedCourse = courses[i];
                break;
            }
        }

        if (!selectedCourse) {
            alert("קורס לא נמצא");
            return;
        }

        try {
            // spinner + disable
            document.body.style.cursor = 'wait';

            // 1️⃣ רישום לקורס (בדיוק כמו המקור)
            const { registerUser } = this.state;

            if (!registerUser) {
                alert("יש לבחור משתמש");
                return;
            }

            await this._Utilities.registerUser(
                selectedCourse.courseId, // courseName.ID
                selectedCourse.ID,       // practicalCourse (מחזור)
                registerUser.id          // 👈 SharePoint user ID
            );

            // 2️⃣ עדכון מונה
            await this._Utilities.addRegisterdNumber(selectedCourse.ID);

            // 3️⃣ Fetch meetings – DEBUG HEAVY
            console.log("📅 [MEETINGS] Fetching meetings for course ID:", selectedCourse.ID);

            console.log("📅 [MEETINGS] Fetching meetings for practical course ID:", selectedCourse.ID);

            const meetings = await this.sp.web.lists
                .getByTitle(this.CoursesMeetingsListName) // "מפגשים"
                .items
                .select("ID", "startDate", "endDate", "location", "actualCourse/ID")
                .expand("actualCourse")
                .filter(`actualCourse/ID eq ${selectedCourse.ID}`)();

            console.log("📅 [MEETINGS] Raw response:", meetings);
            console.log("📅 [MEETINGS] Is array:", Array.isArray(meetings));
            console.log("📅 [MEETINGS] Length:", meetings?.length);


            console.log("📅 [MEETINGS] Raw response:", meetings);
            console.log("📅 [MEETINGS] Is array:", Array.isArray(meetings));
            console.log("📅 [MEETINGS] Length:", meetings?.length);

            if (meetings && Array.isArray(meetings) && meetings.length > 0) {

                await Promise.all(
                    meetings.map(async (meeting, index) => {

                        console.log(`🧩 [MEETING ${index}] raw:`, meeting);
                        console.log(`🧩 [MEETING ${index}] keys:`, Object.keys(meeting));

                        console.log(`🧩 [MEETING ${index}] fields:`, {
                            ID: meeting.ID,
                            startDate: meeting.startDate,
                            finishDate: meeting.endDate,
                            location: meeting.location
                        });

                        const start = new Date(meeting.startDate);
                        const finish = new Date(meeting.endDate);

                        console.log(`📆 [MEETING ${index}] startDate valid:`, !isNaN(start.getTime()));
                        console.log(`📆 [MEETING ${index}] finishDate valid:`, !isNaN(finish.getTime()));

                        console.log(`🛠️ [MEETING ${index}] creating calendar event`);

                        await this._createCalendarEvent(
                            selectedCourse.title,
                            start,
                            finish,
                            meeting.location,
                            meeting.ID,
                            selectedCourse.ID
                        );

                        console.log(`✅ [MEETING ${index}] event created`);
                    })
                );

            } else {
                console.warn("⚠️ [MEETINGS] Empty or invalid meetings – fallback to course dates");

                const start = new Date(selectedCourse.startDate);
                const finish = new Date(selectedCourse.finishDate);

                console.log("📆 [FALLBACK] startDate raw:", selectedCourse.startDate);
                console.log("📆 [FALLBACK] finishDate raw:", selectedCourse.finishDate);
                console.log("📆 [FALLBACK] start valid:", !isNaN(start.getTime()));
                console.log("📆 [FALLBACK] finish valid:", !isNaN(finish.getTime()));

                await this._createCalendarEvent(
                    selectedCourse.title,
                    start,
                    finish,
                    selectedCourse.location ?? '',
                    undefined,
                    selectedCourse.ID
                );

                console.log("✅ [FALLBACK] course-level event created");

            }



            await this.loadCancelUsers();

            this.setState({
                cancelSearchText: '',
                cancelUser: null,
                cancelSelectedCourse: null,
                cancelCoursesForUser: [],
                filteredCancelUsers: []
            });


            alert("המשתמש נרשם בהצלחה");

            this.setState({
                registerUser: null,
                registerCourseId: null,
                searchText: '',
                filteredUsers: []
            });

        } catch (err) {
            console.error("Register failed", err);
            alert("שגיאה ברישום לקורס");
        } finally {
            document.body.style.cursor = 'default';
        }
    };

    private async _createCalendarEvent(courseTitle: string, startDate: Date, finishDate: Date, location?: string, ID?: number, actualCourseId?: number): Promise<void> {
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
                ID: ID,
                actualCourseId: actualCourseId
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


    // Form #3 – Cancel Registration
    private onCancelUserSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        const search = text.toLowerCase();

        // If input was cleared → reset selection
        if (!search) {
            this.setState({
                cancelSearchText: '',
                cancelUser: null,
                cancelSelectedCourse: null,
                cancelCoursesForUser: [],
                filteredCancelUsers: []
            });

            return;
        }

        const filtered: any[] = [];
        const seenUserIds: { [key: number]: true } = {};

        for (let i = 0; i < this.state.cancelUsersFromList.length; i++) {
            const item = this.state.cancelUsersFromList[i];
            const user = item.listedName;
            const name = user?.Title?.toLowerCase() || '';

            if (name.indexOf(search) !== -1 && user?.Id) {
                if (!seenUserIds[user.Id]) {
                    seenUserIds[user.Id] = true;
                    filtered.push(item); // push only once per user
                }
            }
        }



        this.setState({
            cancelSearchText: text,
            filteredCancelUsers: filtered
        });
    };

    private onCancelRegistration = async (e: React.FormEvent) => {
        e.preventDefault();

        const { cancelSelectedCourse } = this.state;

        if (!cancelSelectedCourse) {
            alert("בחר קורס");
            return;
        }

        try {
            document.body.style.cursor = 'wait';

            // 1️⃣ Remove registration item (specific course registration)
            await this._Utilities.removeRegistrations(cancelSelectedCourse.ID);

            // 2️⃣ Decrease registered counter
            await this._Utilities.subtractRegisterdNumber(
                cancelSelectedCourse.practicalCourse.ID
            );

            // 3️⃣ Delete calendar events
            await this._deleteCalendarEvent(
                cancelSelectedCourse.courseName.Title,
                cancelSelectedCourse.practicalCourse.ID
            );

            // 4️⃣ Reload cancel list
            await this.loadCancelUsers();

            // 5️⃣ Reset UI
            this.setState({
                cancelUser: null,
                cancelSelectedCourse: null,
                cancelCoursesForUser: [],
                cancelSearchText: '',
                filteredCancelUsers: []
            });


            alert("הרישום בוטל בהצלחה");

        } catch (err) {
            console.error("Cancel registration failed", err);
            alert("שגיאה בביטול הרישום");
        } finally {
            document.body.style.cursor = 'default';
        }
    };


    private async _deleteCalendarEvent(courseTitle: string, actualCourseId: number): Promise<void> {
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
                courseTitle: courseTitle,
                actualCourseId: actualCourseId
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

    private async loadCancelUsers() {
        const items = await this.sp.web.lists
            .getByTitle("נרשמים לקורס")
            .items
            .select(
                "ID",
                "listedName/Id",
                "listedName/Title",
                "listedName/EMail",
                "courseName/ID",
                "courseName/Title",
                "practicalCourse/startDate",
                "practicalCourse/ID"
            )
            .expand("listedName", "courseName", "practicalCourse")();

        const now = new Date();

        // ✅ Only registrations for courses that did NOT start yet
        const futureOnly = items.filter(item => {
            const startDate = item.practicalCourse?.startDate;
            if (!startDate) return false;

            return new Date(startDate) >= now;
        });

        this.setState({
            cancelUsersFromList: futureOnly
        });
    }



    // Render
    public render(): React.ReactElement {

        const { courses, selectedCourseId, selectedMeetingId } = this.state;
        const now = new Date();

        // Form #2 – Submit button disable
        const canRegister =
            !!this.state.registerUser &&
            !!this.state.registerCourseId &&
            this.state.searchText.trim() !== '';

        // Form #2 - Future courses only
        const futureCourses = courses.filter(c =>
            new Date(c.startDate) >= now
        );

        // Form #2 - Meetings of selected course
        let selectedCourseMeetings: IMeeting[] = [];
        for (let i = 0; i < courses.length; i++) {
            if (courses[i].ID === selectedCourseId) {
                selectedCourseMeetings = courses[i].meetings;
                break;
            }
        }

        // Form #3 – Submit button disable
        const canCancel =
            !!this.state.cancelUser &&
            !!this.state.cancelSelectedCourse;


        // UI Render
        return (
            <div>
                <div className={styles.managerContainer}>

                    {/* Form #1 – Update Meeting */}
                    <form className={styles.managerCard} onSubmit={this.onSubmit}>
                        <h3 className={styles.managerSectionTitle}>עדכון מפגש</h3>

                        {/* Course selection */}
                        <div className={styles.managerRow}>
                            <label className={styles.managerLabel}>קורס</label>
                            <select
                                className={styles.managerSelect}
                                value={selectedCourseId ?? ''}
                                onChange={this.onCourseChange}
                            >
                                <option value="">בחר</option>
                                {futureCourses.map(c => (
                                    <option key={c.ID} value={c.ID}>
                                        {c.title} | {this.formatDateTime(c.startDate)}

                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Meeting selection */}
                        <div className={styles.managerRow}>
                            <label className={styles.managerLabel}>מפגש</label>
                            <select
                                className={styles.managerSelect}
                                disabled={!selectedCourseId}
                                value={selectedMeetingId ?? ''}
                                onChange={this.onMeetingChange}
                            >
                                <option value="">בחר</option>
                                {selectedCourseMeetings.map((m, index) => (
                                    <option key={m.ID} value={m.ID}>
                                        מפגש {index + 1} | {this.formatDateTime(m.startDate)}
                                    </option>

                                ))}
                            </select>
                        </div>

                        {/* Render meeting details only after course and meeting are selected */}
                        {selectedMeetingId && (
                            <>
                                {/* Start date */}
                                <div className={styles.managerRow}>
                                    <label className={styles.managerLabel}>תאריך התחלה</label>
                                    <input
                                        ref={this.startDateRef}
                                        type="text"
                                        className={styles.managerInput}
                                        placeholder="DD/MM/YYYY HH:mm"
                                    />

                                </div>

                                {/* End date */}
                                <div className={styles.managerRow}>
                                    <label className={styles.managerLabel}>תאריך סיום</label>
                                    <input
                                        ref={this.endDateRef}
                                        type="text"
                                        className={styles.managerInput}
                                        placeholder="DD/MM/YYYY HH:mm"
                                    />

                                </div>

                                {/* Location */}
                                <div className={styles.managerRow}>
                                    <label className={styles.managerLabel}>מיקום</label>
                                    <input
                                        className={styles.managerInput}
                                        type="text"
                                        value={this.state.location}
                                        onChange={e => this.setState({ location: e.target.value })}
                                    />
                                </div>

                                {/* Submit Button */}
                                <div className={styles.managerActions}>
                                    <button className={styles.managerButton} type="submit">
                                        שמור
                                    </button>
                                </div>
                            </>
                        )}

                    </form>


                    {/* Form #2 – Register User to Course */}
                    <form
                        className={styles.managerCard}
                        style={{ marginTop: '24px' }}
                        onSubmit={this.onRegisterUserToCourse}
                    >
                        <h3 className={styles.managerSectionTitle}>רישום משתמש לקורס</h3>

                        {/* User picker */}
                        <div className={styles.managerRow}>
                            <label className={styles.managerLabel}>משתמש</label>
                            <div className={styles.managerSelectWrapper}>
                                <input
                                    className={styles.managerSelect}
                                    placeholder="חפש משתמש..."
                                    value={this.state.searchText}
                                    onChange={this.onRegisterUserSearch}
                                />

                                {this.state.searchText.trim() !== "" &&
                                    this.state.filteredUsers.length > 0 && (

                                        <ul className={styles.managerDropdown}>
                                            {this.state.filteredUsers.map(u => (
                                                <li
                                                    key={u.id}
                                                    className={styles.managerDropdownItem}
                                                    onClick={() =>
                                                        this.setState({
                                                            registerUser: u,
                                                            searchText: u.text,
                                                            filteredUsers: []
                                                        })
                                                    }
                                                >
                                                    {u.text}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                            </div>
                        </div>

                        {/* Course dropdown */}
                        <div className={styles.managerRow}>
                            <label className={styles.managerLabel}>קורס</label>
                            <select
                                className={styles.managerSelect}
                                value={this.state.registerCourseId ?? ''}
                                onChange={(e) =>
                                    this.setState({ registerCourseId: Number(e.target.value) })
                                }
                            >
                                <option value="">בחר קורס</option>
                                {futureCourses.map(c => (
                                    <option key={c.ID} value={c.ID}>
                                        {c.title} | {this.formatDateTime(c.startDate)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Submit Button */}
                        <div className={styles.managerActions}>
                            <button
                                className={styles.managerButton}
                                type="submit"
                                disabled={!canRegister}
                            >
                                רשום לקורס
                            </button>

                        </div>
                    </form>


                    {/* Form #3 – Cancel Registration */}
                    <form
                        className={styles.managerCard}
                        style={{ marginTop: '24px', paddingBottom: '100px' }}
                        onSubmit={this.onCancelRegistration}
                    >
                        <h3 className={styles.managerSectionTitle}>ביטול רישום לקורס</h3>

                        {/* User picker */}
                        <div className={styles.managerRow}>
                            <label className={styles.managerLabel}>משתמש</label>
                            <div className={styles.managerSelectWrapper}>
                                <input
                                    type="text"
                                    className={styles.managerSelect}
                                    placeholder="חפש משתמש..."
                                    value={this.state.cancelSearchText}
                                    onChange={this.onCancelUserSearch}
                                />
                                {this.state.cancelSearchText.trim() !== '' &&
                                    this.state.filteredCancelUsers.length > 0 && (
                                        <ul className={styles.managerDropdown}>
                                            {this.state.filteredCancelUsers.slice(0, 10).map(item => (
                                                <li
                                                    key={item.ID}
                                                    className={styles.managerDropdownItem}
                                                    onClick={() => {
                                                        const userCourses = this.state.cancelUsersFromList.filter(
                                                            i => i.listedName?.Title === item.listedName?.Title
                                                        );

                                                        this.setState({
                                                            cancelUser: item.listedName,   // 👈 USER ONLY
                                                            cancelSearchText: item.listedName?.Title || '',
                                                            filteredCancelUsers: [],
                                                            cancelCoursesForUser: userCourses,
                                                            cancelSelectedCourse: null
                                                        });
                                                    }}

                                                >
                                                    {item.listedName?.Title}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                            </div>
                        </div>

                        {/* Course selector */}
                        <div className={styles.managerRow}>
                            <label className={styles.managerLabel}>קורס</label>

                            <select
                                className={styles.managerSelect}
                                value={this.state.cancelSelectedCourse?.ID ?? ''}
                                disabled={!this.state.cancelCoursesForUser.length}
                                onChange={e => {
                                    const selectedId = Number(e.target.value);
                                    let selectedCourse = null;

                                    for (let i = 0; i < this.state.cancelCoursesForUser.length; i++) {
                                        if (this.state.cancelCoursesForUser[i].ID === selectedId) {
                                            selectedCourse = this.state.cancelCoursesForUser[i];
                                            break;
                                        }
                                    }

                                    this.setState({ cancelSelectedCourse: selectedCourse });
                                }}
                            >
                                <option value="">בחר קורס</option>

                                {this.state.cancelCoursesForUser.map(c => (
                                    <option key={c.ID} value={c.ID}>
                                        {c.courseName?.Title} | {this.formatDateTime(c.practicalCourse?.startDate)}
                                    </option>
                                ))}
                            </select>
                        </div>



                        {/* Submit Button */}
                        <div className={styles.managerActions}>
                            <button
                                className={styles.managerButton}
                                type="submit"
                                disabled={!canCancel}
                            >
                                בטל רישום
                            </button>

                        </div>
                    </form>
                </div>
            </div>
        );
    }
}