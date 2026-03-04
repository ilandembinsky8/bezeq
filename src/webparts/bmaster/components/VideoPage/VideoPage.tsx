import * as React from 'react';
import styles from './VideoPage.module.scss';
import { SPFI } from "@pnp/sp";
import { getSP } from "../../PNPConfig/pnpjsConfig";

export interface IManagerPageProps {
    context: any;
}

interface IVideoItem {
    embedUrl: string;
    title: string;
}

export interface IManagerPageState {
    videos: IVideoItem[];
}

export default class ManagerPage extends React.Component<
    IManagerPageProps,
    IManagerPageState
> {
    private sp: SPFI;
    private VideosLibraryName = "סרטונים";

    constructor(props: IManagerPageProps) {
        super(props);
        this.sp = getSP();

        this.state = {
            videos: []
        };
    }

    public async componentDidMount(): Promise<void> {
        const courseId = this.getCourseIdFromUrl();
        if (!courseId) return;

        await this.loadCourseVideos(courseId);
    }

    // ---------------- Helpers ----------------

    private getCourseIdFromUrl(): number | null {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("CourseID");
        return id ? Number(id) : null;
    }

    private async loadCourseVideos(courseId: number): Promise<void> {
        try {
            const items = await this.sp.web.lists
                .getByTitle(this.VideosLibraryName)
                .items
                .select(
                    "Id",
                    "UniqueId",
                    "videoTitle",
                    "videoOrder",
                    "course/Id"
                )
                .expand("course")
                .filter(`course/Id eq ${courseId}`)
                .orderBy("videoOrder", true)(); // 1,2,3...


            if (!items.length) {
                console.warn("No videos found for course:", courseId);
                return;
            }

            const webUrl = this.props.context.pageContext.web.absoluteUrl;

            const videos: IVideoItem[] = items
                .filter(i => i.UniqueId)
                .map(item => ({
                    embedUrl:
                        `${webUrl}/_layouts/15/embed.aspx?UniqueId=${item.UniqueId}`,
                    title: item.videoTitle
                }));

            this.setState({ videos });

        } catch (err) {
            console.error("Failed loading course videos", err);
        }
    }

    // ---------------- Render ----------------

    public render(): React.ReactElement {
        const { videos } = this.state;

        return (
            <div className={styles.videoContainer}>
                <div className={styles.videoGrid}>
                    {videos.map((video, index) => (
                        <div key={index} className={styles.videoCard}>
                            <div className={styles.videoTitle}>
                                {video.title}
                            </div>

                            <div className={styles.videoWrapper}>
                                <iframe
                                    src={video.embedUrl}
                                    allow="autoplay; fullscreen"
                                    allowFullScreen
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}
