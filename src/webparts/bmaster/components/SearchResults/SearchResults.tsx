import * as React from 'react';
import styles from './SearchResults.module.scss';
import { Utilities } from "../Utilities/Utilities";

export interface ISearchResultsProps {
    title?: string;
}

export interface ISearchResultsState {
    searchQuery: string;
    courseSections: { title: string; description: string; link: string; image?: string }[]; // Updated type
}

export default class SearchResults extends React.Component<ISearchResultsProps, ISearchResultsState> {
    private utilities: Utilities;

    constructor(props: ISearchResultsProps) {
        super(props);

        // Extract 'q' from the URL
        const queryParams = new URLSearchParams(window.location.search);
        const searchQuery = queryParams.get('q') || '';

        this.state = {
            searchQuery: decodeURIComponent(searchQuery),
            courseSections: [], // Initialize with an empty array
        };

        this.utilities = new Utilities(); // Instantiate Utilities class
    }

    async componentDidMount() {
        try {
            const courses = await this.utilities._fetchMergedCourseData(this.state.searchQuery);
            this.setState({ courseSections: courses });
        } catch (error) {
            console.error('Error fetching course sections:', error);
        }
    }


    public render(): React.ReactElement<{}> {
        return (
            <div>
                <div className={styles.topSeperator}>
                    <div className={styles.right_oneCourse}>&nbsp;</div>
                    <div className={styles.center_oneCourse}>
                        <div style={{ float: "right", marginLeft: "30px", marginRight: "30px" }}>
                            <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/SEARCH_ICON.png" style={{ height: "30px" }} alt="Search Icon" />
                        </div>
                        <div className={styles.text} style={{ float: "right", color: "#adf9ff", fontSize: "1.667rem" }}>
                            תוצאות חיפוש: "{this.state.searchQuery}"
                        </div>
                    </div>
                    <div className={styles.left_oneCourse}>&nbsp;</div>
                </div>

                <div className={styles.search}>
                    {/* <h2>תוצאות חיפוש: {this.state.searchQuery}</h2> */}
                    <div style={{ float: "right", width: "100%", marginTop: "100px" }}> {/* Container div for all search results */}
                        {this.state.courseSections.map((item, index) => (
                            <div key={index}>
                                <a href={item.link}>
                                    <div key={index} style={{ float: "right", width: "80%", marginRight: "10%" }}> {/* Search result item container */}
                                        <div style={{ float: "right", width: "100%", color: "#adf9ff", fontSize: "36px" }}>{item.title}</div> {/* Title of search result item */}
                                        <div style={{ float: "right", width: "100%", color: "#FFFFFF", fontSize: "28px" }}> {/* Container of details of search result items */}
                                            <div
                                                style={{ float: "right", width: "70%" }}
                                                dangerouslySetInnerHTML={{ __html: item.description || 'קורס ללא תיאור' }}
                                            >
                                            </div>
                                            <div style={{ float: "right", width: "12%" }}> {/* Search result item pic #1 - No connection to image in code */}
                                                <img src={item.image} style={{ maxWidth: "80%" }} alt="Item image 1" />
                                            </div>
                                            <div style={{ float: "right", width: "18%" }}> {/* Search result item pic #2 - No connection to image in code */}
                                                <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/logo1.png" style={{ maxWidth: "80%" }} alt="Item image 2" />
                                            </div>
                                        </div>
                                    </div>
                                </a>
                                <div style={{ float: "right", width: "100%", marginTop: "10px" }}>
                                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/line.png" style={{ width: "90%" }} alt="Line" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
}
