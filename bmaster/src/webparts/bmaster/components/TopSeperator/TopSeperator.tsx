import * as React from 'react';
import styles from './topSeperator.module.scss';
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { SPFI, spfi } from "@pnp/sp";

export interface ITopSeperatorProps {
    PageType: string;
}

export interface ITopSeperatorState {
    courseTitle: string;
}

export default class TopSeperator extends React.Component<ITopSeperatorProps, ITopSeperatorState> {
    private _utils: Utilities;
    private _sp: SPFI;

    constructor(props: ITopSeperatorProps) {
        super(props);
        this._utils = new Utilities();
        this._sp = getSP();
        this.state = {
            courseTitle: ""
        };
    }

    public async componentDidMount(): Promise<void> {
        try {
            const data = await this._utils.getCategoryTitleByCourseID();
            if (data && data.length > 0) {
                const item = data[0];
                if (item.isCategory) {
                    this.setState({ courseTitle: item.Title });
                } else if (item.field && item.field.Title) {
                    this.setState({ courseTitle: item.field.Title });
                } else {
                    console.warn("Unexpected data shape:", item);
                }
            }
        } catch (error) {
            console.error("Error fetching course title:", error);
        }
        
    }

    public getTitleText(): string {
        return this.state.courseTitle || "";
    }

    public render(): React.ReactElement<{}> {
        const _PageType = this.props.PageType;
        return (
            <>
                {_PageType == 'Courses'
                    && (<>
                        <div className={styles.courseTitle}>{this.getTitleText()}</div>
                        <div className={styles.topSeperator}>
                        </div>
                    </>)
                }

                {_PageType == 'OneCourse'
                    && (<>
                        <div className={styles.courseTitle}>{this.getTitleText()}</div>
                        <div className={styles.topSeperator}>
                        </div>
                    </>)
                }

                {_PageType == 'CourseSign'
                    && (<>
                        <div className={styles.courseTitle}>{this.getTitleText()}</div>
                        <div className={styles.topSeperator}>
                        </div>
                    </>)
                }

                {_PageType == 'OneCourseThanks'
                    && (<>
                        <div className={styles.courseTitle}>{this.getTitleText()}</div>
                        <div className={styles.topSeperator}>
                        </div>
                    </>)
                }

                {_PageType == 'SearchResults'
                    && (<>
                    <div className={styles.topSeperator}>
                    </div>
                    </>)
                }
            </>
        );
    }
}
