import * as React from 'react';
import styles from './ContactUs.module.scss';
import { SPFI } from "@pnp/sp";
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface ICourseSignProps {
    title?: string;
    context: WebPartContext;
}

export interface ICourseSignState {
    userEmail: string | null;
    userId: number | null;
    messageContent: string;
    isSubmitted: boolean;
}

export default class CourseSign extends React.Component<ICourseSignProps, ICourseSignState> {

    private _sp: SPFI;
    private _Utilities: Utilities;

    constructor(props: ICourseSignProps) {
        super(props);

        this.state = {
            userEmail: null,
            userId: null,
            messageContent: "",
            isSubmitted: false
        };

        this._sp = getSP();
        this._Utilities = new Utilities();
    }

    public async componentDidMount(): Promise<void> {
        const currentUser = await this._sp.web.currentUser();
        this.setState({
            userEmail: currentUser.Email,
            userId: currentUser.Id
        });
    }

    private _handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({ messageContent: event.target.value });
    };

    private _handleSubmit = async (): Promise<void> => {

        if (!this.state.userId || !this.state.messageContent.trim()) {
            return;
        }

        try {
            await this._sp.web.lists.getByTitle("ContactUs").items.add({
                senderMailId: this.state.userId,   // Person column
                content: this.state.messageContent
            });

            this.setState({
                messageContent: "",
                isSubmitted: true
            });

        } catch (error) {
            console.error("Error creating item:", error);
        }
    };

    public render(): React.ReactElement<{}> {

        if (this.state.isSubmitted) {
            return (
                <div className={styles.thankYouContainer}>
                    <div className={styles.thankYouMessage}>
                        תודה על הפנייה!<br /><br />
                        אנחנו תמיד שמחים לשמוע ממנהלות ומנהלים שמשקיעים בפיתוח שלהם.
                        נחזור אליך ממש בקרוב.<br /><br />
                        הנה טעימה מהתכנים באתר שהמנהלים שלנו הכי אוהבים:
                        <br />
                        <a
                            href="https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/Courses.aspx?SectionID=19"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            לחצו כאן
                        </a>
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.astronaut}>
                <div className={styles.inputArea}>
                    <div className={styles.right_courses}>
                        <div className={styles.contactTitle}>
                            דברו אלינו
                        </div>
                    </div>

                    <div className={styles.contactBlueLine} />

                    <div className={styles.r100}>
                        <textarea
                            className={styles.astro}
                            placeholder="הקלידו כאן..."
                            value={this.state.messageContent}
                            onChange={this._handleTextChange}
                        />
                    </div>

                    <div className={styles.contactBlueLine} />

                    <button
                        type="button"
                        className={styles.contactButton}
                        onClick={this._handleSubmit}
                    >
                        שליחה
                    </button>
                </div>
            </div>
        );
    }
}
