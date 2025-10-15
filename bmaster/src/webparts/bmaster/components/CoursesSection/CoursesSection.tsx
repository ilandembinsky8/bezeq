import * as React from 'react';
import styles from './CoursesSection.module.scss';
//import type { IBmasterProps } from './IBmasterProps';
import { escape } from '@microsoft/sp-lodash-subset';
import { SPFI, spfi } from "@pnp/sp";
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { Item, Items } from '@pnp/sp/items';
import { PeoplePicker, PrincipalType } from "@pnp/spfx-controls-react/lib/PeoplePicker";


//Import font Awesome
import { SPComponentLoader } from '@microsoft/sp-loader';

import { ICourseSections, ICoursesPhotos } from "../Interface/BmasterSPListInterface";

export interface ICoursesSectionProps {
    title?: string;
}

export interface ICoursesSectionState {
    items: any[];
    itemsPhotos: ICoursesPhotos[];
    sectionsItems: ICourseSections[];
    likeCounts: { [key: number]: number };
    commentCounts: { [key: number]: number };
    showLikesPopup: boolean;
    likedUsers: string[];
    showCommentPopup: boolean;
    commentText: string;
    activeCourseId: number | null;
    activeSectionId: number | null;
    showCommentsPopup: boolean;
    commentsList: { author: string; text: string }[];
    showPeoplePickerPopup: boolean;
    selectedUsers: any[];

}

export default class CoursesSection extends React.Component<ICoursesSectionProps, ICoursesSectionState, {}> {

    private _sp: SPFI;
    private _Utilities: Utilities;

    constructor(props: ICoursesSectionProps) {
        super(props);
        // set initial state
        this.state = {
            items: [],
            itemsPhotos: [],
            sectionsItems: [],
            likeCounts: {},
            commentCounts: {},
            showLikesPopup: false,
            likedUsers: [],
            showCommentPopup: false,
            commentText: "",
            activeCourseId: null,
            activeSectionId: null,
            showCommentsPopup: false,
            showPeoplePickerPopup: false,
            selectedUsers: [],
            commentsList: []
        };
        this._sp = getSP();
        this._Utilities = new Utilities();

        //Add Font Awesome
        SPComponentLoader.loadCss('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');
        //this.handleCallShowHideModal = this.handleCallShowHideModal.bind(this);
        this._getItems();
    }

    // Add new hover functionality methods
    private closeIt = (x: string): void => {
        const y = "d" + x;
        const z = "e" + x;
        const w = "f" + x;
        const yElem = document.getElementById(y);
        const zElem = document.getElementById(z);
        const wElem = document.getElementById(w);
        if (yElem) {
            yElem.style.marginTop = "190px";
            yElem.style.backgroundPositionX = "43.5%";
        }
        if (zElem) zElem.style.display = "none";
        if (wElem) wElem.style.marginTop = "10px";
    }

    private handleMouseOver = (i: number): void => {
        const x1 = i.toString();
        const y = "d" + x1;
        const z = "e" + x1;
        const w = "f" + x1;

        const yElem = document.getElementById(y);
        const zElem = document.getElementById(z);
        const wElem = document.getElementById(w);

        if (yElem) {
            yElem.style.marginTop = "20px";
            yElem.style.backgroundPositionX = "62.5%";
        }
        if (zElem) zElem.style.display = "inline";
        if (wElem) wElem.style.marginTop = "70px";
    };

    private handleMouseLeave = (i: number): void => {
        this.closeIt(i.toString());
    };


    private async _getItems() {
        const items: any[] = await this._Utilities._getCoursesBySectionID();
        // debugger;   
        this.setState({ items });
        const sectionsItems: ICourseSections[] = await this._Utilities._getAllCourseSections();
        this.setState({ sectionsItems });
        console.table(sectionsItems);

        // const _PhotoType = 'תמונה קטנה';
        // const itemsPhotos:ICoursesPhotos[] = await this._Utilities._getAllCoursesSmallBigPhoto(_PhotoType);

        const itemsPhotos: ICoursesPhotos[] = await this._Utilities._getAllCoursesSmallPhoto();
        this.setState({ itemsPhotos });
        console.table(itemsPhotos);

        const likeCounts: { [key: number]: number } = {};
        for (const course of items) {
            const count = await this._getLikesCount(course.ID, null);
            likeCounts[course.ID] = count;
        }
        this.setState({ likeCounts });

        const commentCounts: { [key: number]: number } = {};

        for (const course of items) {
            const count = await this._getCommentsCount(course.ID, null);
            commentCounts[course.ID] = count;
        }

        for (const section of sectionsItems) {
            const count = await this._getCommentsCount(null, section.ID);
            commentCounts[section.ID] = count;
        }

        this.setState({ commentCounts });


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

    private _goToOneCourse(_ItemID: any) {
        // debugger;
        let __OneCourseUrl = "/sites/Bmaster/SitePages/OneCourse.aspx?CourseID=";
        __OneCourseUrl += _ItemID;
        window.location.href = __OneCourseUrl;
    }

    //Like / Unlike Function
    private async _handleLikeClick(
        courseId: number | null,
        courseTitle: string,
        sectionId: number | null
    ): Promise<void> {
        try {
            const currentUser = await this._sp.web.currentUser();

            const isCourseLike = courseId !== null;
            const isSectionLike = !isCourseLike && sectionId !== null;

            if (!isCourseLike && !isSectionLike) {
                console.warn("⚠️ No courseId or sectionId provided — cannot save like.");
                return;
            }

            // Check if user already liked this item
            const existingLikes = await this._sp.web.lists
                .getByTitle("Likes")
                .items.filter(
                    `likedBy/Id eq ${currentUser.Id} and ${isCourseLike
                        ? `courseID eq ${courseId}`
                        : `sectionID eq ${sectionId}`
                    }`
                )();

            if (existingLikes.length > 0) {
                // User already liked - remove the like
                const likeId = existingLikes[0].Id;
                await this._sp.web.lists.getByTitle("Likes").items.getById(likeId).delete();
                console.log(`❌ Like removed for ${courseTitle}`);

                // Update count immediately
                const newCount = await this._getLikesCount(courseId, sectionId);
                this.setState(prev => ({
                    likeCounts: { ...prev.likeCounts, [courseId ?? sectionId!]: newCount }
                }));

                return;
            }

            // Add new like (People Picker field)
            await this._sp.web.lists.getByTitle("Likes").items.add({
                Title: courseTitle,
                courseID: courseId,
                sectionID: sectionId,
                likedById: currentUser.Id // People Picker reference
            });

            console.log(`✅ Like saved for ${courseTitle}`);

            // Update count immediately
            const newCount = await this._getLikesCount(courseId, sectionId);
            this.setState(prev => ({
                likeCounts: { ...prev.likeCounts, [courseId ?? sectionId!]: newCount }
            }));

        } catch (error) {
            console.error("❌ Error toggling like:", error);
        }
    }


    // Get total likes count
    private async _getLikesCount(
        courseId: number | null,
        sectionId: number | null
    ): Promise<number> {
        try {
            const filter =
                courseId !== null
                    ? `courseID eq ${courseId}`
                    : `sectionID eq ${sectionId}`;

            const likes = await this._sp.web.lists
                .getByTitle("Likes")
                .items.filter(filter)
                .select("ID")();

            return likes.length;
        } catch (error) {
            console.error("Error fetching like count:", error);
            return 0;
        }
    }

    // Get total comments count
    private async _getCommentsCount(
        courseId: number | null,
        sectionId: number | null
    ): Promise<number> {
        try {
            let filter = "";

            if (courseId !== null) {
                // count comments linked to this course
                filter = `(courseID eq ${courseId} or sectionID eq ${courseId})`;
            } else if (sectionId !== null) {
                // count comments linked to this section
                filter = `(sectionID eq ${sectionId} or courseID eq ${sectionId})`;
            } else {
                console.warn("⚠️ No courseId or sectionId provided — cannot fetch comments.");
                return 0;
            }

            const comments = await this._sp.web.lists
                .getByTitle("Comments")
                .items.filter(filter)
                .select("ID")();

            return comments.length;
        } catch (error) {
            console.error("❌ Error fetching comment count:", error);
            return 0;
        }
    }




    // Fetch all users who liked a course or section
    private async _getLikedUsers(courseId: number | null, sectionId: number | null): Promise<void> {
        try {
            const filter =
                courseId !== null
                    ? `courseID eq ${courseId}`
                    : `sectionID eq ${sectionId}`;

            const likes = await this._sp.web.lists
                .getByTitle("Likes")
                .items.filter(filter)
                .select("likedBy/Title", "likedBy/EMail")
                .expand("likedBy")();

            const userNames = likes
                .filter(l => l.likedBy)
                .map(l => l.likedBy.Title);

            this.setState({
                likedUsers: userNames,
                showLikesPopup: true
            });
        } catch (error) {
            console.error("Error fetching liked users:", error);
        }
    }

    // Fetch all comments for a course or section
    private async _getCommentsList(courseId: number | null, sectionId: number | null): Promise<void> {
        try {
            let filter = "";

            if (courseId !== null) {
                filter = `(courseID eq ${courseId} or sectionID eq ${courseId})`;
            } else if (sectionId !== null) {
                filter = `(sectionID eq ${sectionId} or courseID eq ${sectionId})`;
            } else {
                console.warn("⚠️ No courseId or sectionId provided — cannot fetch comments list.");
                return;
            }

            const comments = await this._sp.web.lists
                .getByTitle("Comments")
                .items.filter(filter)
                .select("comment", "commentedBy/Title", "commentedBy/EMail")
                .expand("commentedBy")();

            const formattedComments = comments.map((c: any) => ({
                author: c.commentedBy?.Title || "Unknown",
                text: c.comment || ""
            }));

            this.setState({
                commentsList: formattedComments,
                showCommentsPopup: true
            });
        } catch (error) {
            console.error("❌ Error fetching comments list:", error);
        }
    }



    // Close popup
    private _closeLikesPopup = (): void => {
        this.setState({ showLikesPopup: false, likedUsers: [] });
    };

    private _closeCommentsPopup = (): void => {
        this.setState({ showCommentsPopup: false, commentsList: [] });
    };


    // Open Comment Popup for a specific course or section
    private _openCommentPopup = (courseId: number | null, sectionId: number | null): void => {
        this.setState({
            showCommentPopup: true,
            activeCourseId: courseId,
            activeSectionId: sectionId
        });
    };

    // Close Comment Popup
    private _closeCommentPopup = (): void => {
        this.setState({ showCommentPopup: false, commentText: "" });
    };

    // Handle Text Input
    private _handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ commentText: e.target.value });
    };

    // Save Comment Function
    private async _handleSendComment(
        courseId: number | null,
        sectionId: number | null
    ): Promise<void> {
        try {
            const currentUser = await this._sp.web.currentUser();

            if (!this.state.commentText.trim()) {
                console.warn("Please enter a comment before sending.");
                return;
            }

            const isCourseComment = courseId !== null;
            const isSectionComment = !isCourseComment && sectionId !== null;

            if (!isCourseComment && !isSectionComment) {
                console.warn("⚠️ No courseId or sectionId provided — cannot save comment.");
                return;
            }

            // Add comment to SharePoint list
            await this._sp.web.lists.getByTitle("Comments").items.add({
                comment: this.state.commentText,
                commentedById: currentUser.Id, // People Picker field
                courseID: courseId,
                sectionID: sectionId
            });

            console.log(`Comment saved successfully for ${isCourseComment ? "course" : "section"}!`);

            // Update the comment count immediately
            const newCount = await this._getCommentsCount(courseId, sectionId);
            this.setState(prev => ({
                commentCounts: { ...prev.commentCounts, [courseId ?? sectionId!]: newCount },
                commentText: "",
                showCommentPopup: false
            }));

        } catch (error) {
            console.error("❌ Error saving comment:", error);
        }
    }

    public render(): React.ReactElement<{}> {
        const _items: any[] = this.state.items;
        const _sectionsItems: any[] = this.state.sectionsItems;
        const url: any = new URL(window.location.href);
        var _SectionID = parseInt(url.searchParams.get("SectionID") || "0", 10);

        return (
            <>
                <div className={styles.topSeperator}>
                    {/* <div style={{ margin: "0px auto", width: "1520px" }}> */}
                    <div className={styles.topSeperatorContainer}>
                        <div className={styles.right_courses}>
                            {_sectionsItems
                                .filter(item => item.ID === _SectionID)
                                .map((item, i) => (
                                    <div key={i}>{item.titleRight}</div>
                                ))}
                        </div>
                        <div className={styles.center_courses}>
                            {_sectionsItems
                                .filter(item => item.ID === _SectionID)
                                .map((item, i) => (
                                    <div key={i}>{item.titleLeft}</div>
                                ))}
                        </div>
                    </div>
                </div>

                <div className={styles.coursesSection}>
                    <div className={styles.inner}>
                        {_sectionsItems.some(item => item.ID === _SectionID) && (
                            _items
                                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                .map((Course, i) => (
                                    <div
                                        key={`c${i + 1}`}
                                        id={`c${i + 1}`}
                                        className={`${styles.oneCourse} ${Course.isSoldOut ? styles.soldOut : ''}`}
                                        style={{ backgroundImage: `url('${this._getHtml(Course.ID)}')` }}
                                        onClick={() => Course.otherLink ? window.location.href = Course.otherLink : this._goToOneCourse(Course.ID)}
                                    // onMouseOver={() => this.handleMouseOver(i + 1)}
                                    // onMouseLeave={() => this.handleMouseLeave(i + 1)}
                                    >
                                        {Course.isSoldOut && (
                                            <div className={styles.soldOutBanner}></div>
                                        )}

                                        <div id={`d${i + 1}`} className={styles.courseName}>
                                            {Course.Title}
                                        </div>

                                        <div
                                            id={`e${i + 1}`}
                                            className={styles.courseContent}
                                            style={{ float: 'left', width: '100%', color: 'white', textAlign: 'center' }}
                                            dangerouslySetInnerHTML={{ __html: Course.innerText1 }}
                                        >
                                            {/* {Course.innerText1}<br />{Course.innerText2}  */}

                                        </div>

                                        <div id={`f${i + 1}`} className={styles.smallButton}>
                                            <div className={styles.actionButtons}>
                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.likeButton}`}
                                                        title="אהבתי"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // prevents navigating to the course
                                                            this._handleLikeClick(Course.ID, Course.Title, null);
                                                        }}
                                                    >
                                                        <i className="fas fa-heart"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getLikedUsers(Course.ID, null);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.likeCounts[Course.ID] ?? 0}
                                                    </span>
                                                </div>

                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.commentButton}`}
                                                        title="תגובות"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._openCommentPopup(Course.ID, null);
                                                        }}
                                                    >
                                                        <i className="fas fa-comment"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getCommentsList(Course.ID, null);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.commentCounts[Course.ID] ?? 0}
                                                    </span>

                                                </div>



                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.shareButton}`}
                                                        title="שתף"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this.setState({ showPeoplePickerPopup: true });
                                                        }}
                                                    >
                                                        <i className="fas fa-share-alt"></i>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                ))
                        )}

                        {_sectionsItems.some(item => item.ID === _SectionID && item.isCategory === true) && (
                            _sectionsItems
                                .filter(Course => Course.fieldId === _SectionID)
                                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                .map((Course, i) => (
                                    <div
                                        key={`c${i + 1}`}
                                        id={`c${i + 1}`}
                                        className={styles.oneCourse}
                                        style={{ backgroundImage: `url('${Course.theImage.Url}')` }}
                                        onClick={() => window.location.href = '/sites/Bmaster/SitePages/Courses.aspx?SectionID=' + Course.ID}
                                    // onMouseOver={() => this.handleMouseOver(i + 1)}
                                    // onMouseLeave={() => this.handleMouseLeave(i + 1)}
                                    >
                                        <div id={`d${i + 1}`} className={styles.courseName}>
                                            {Course.Title}
                                        </div>
                                        <div
                                            id={`e${i + 1}`}
                                            className={styles.courseContent}
                                            style={{ float: 'left', width: '100%', color: 'white', textAlign: 'center' }}
                                            dangerouslySetInnerHTML={{ __html: Course.addedText }}
                                        >
                                        </div>

                                        <div id={`f${i + 1}`} className={styles.smallButton}>
                                            <div className={styles.actionButtons}>
                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.likeButton}`}
                                                        title="אהבתי"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // prevents navigating to the course
                                                            this._handleLikeClick(null, Course.Title, Course.ID);
                                                        }}
                                                    >
                                                        <i className="fas fa-heart"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getLikedUsers(null, Course.ID);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.likeCounts[Course.ID] ?? 0}
                                                    </span>

                                                </div>

                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.commentButton}`}
                                                        title="תגובות"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._openCommentPopup(null, Course.ID);
                                                        }}
                                                    >
                                                        <i className="fas fa-comment"></i>
                                                    </span>
                                                    <span
                                                        className={styles.countLabel}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._getCommentsList(null, Course.ID);
                                                        }}
                                                        style={{ cursor: "pointer", textDecoration: "underline" }}
                                                    >
                                                        {this.state.commentCounts[Course.ID] ?? 0}
                                                    </span>
                                                </div>



                                                <div className={styles.actionItem}>
                                                    <span
                                                        className={`${styles.iconWrapper} ${styles.shareButton}`}
                                                        title="Share"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            this.setState({ showPeoplePickerPopup: true });
                                                        }}
                                                    >
                                                        <i className="fas fa-share-alt"></i>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                        {this.state.showLikesPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>סימוני אהבתי</h3>
                                        <span className={styles.closeBtn} onClick={this._closeLikesPopup}>✖</span>
                                    </div>
                                    <div className={styles.popupContent}>
                                        {this.state.likedUsers.length > 0 ? (
                                            <ul>
                                                {this.state.likedUsers.map((name, index) => (
                                                    <li key={index}>{name}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>ללא סימוני אהבתי</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {this.state.showCommentPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>תגובה חדשה</h3>
                                        <span className={styles.closeBtn} onClick={this._closeCommentPopup}>✖</span>
                                    </div>
                                    <div className={styles.popupContent}>
                                        <textarea
                                            className={styles.commentTextarea}
                                            placeholder="רשום תגובה..."
                                            value={this.state.commentText}
                                            onChange={this._handleCommentChange}
                                        ></textarea>
                                        <div className={styles.commentActions}>
                                            <button
                                                className={styles.commentBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    this._handleSendComment(this.state.activeCourseId, this.state.activeSectionId);
                                                }}
                                            >
                                                שלח
                                            </button>


                                            <button className={styles.commentCancelBtn} onClick={this._closeCommentPopup}>
                                                ביטול
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {this.state.showCommentsPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>תגובות</h3>
                                        <span className={styles.closeBtn} onClick={this._closeCommentsPopup}>✖</span>
                                    </div>
                                    <div className={styles.popupContent}>
                                        {this.state.commentsList.length > 0 ? (
                                            <ul>
                                                {this.state.commentsList.map((c, index) => (
                                                    <li key={index}>
                                                        <strong>{c.author}:</strong> {c.text}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>אין תגובות</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {this.state.showPeoplePickerPopup && (
                            <div className={styles.popupOverlay}>
                                <div className={styles.popupContainer}>
                                    <div className={styles.popupHeader}>
                                        <h3>בחר משתמשים לשיתוף</h3>
                                        <span
                                            className={styles.closeBtn}
                                            onClick={() => this.setState({ showPeoplePickerPopup: false })}
                                        >
                                            ✖
                                        </span>
                                    </div>

                                    <div className={styles.popupContent}>
                                        <PeoplePicker
                                            context={this._sp as any}
                                            titleText="משתמשים"
                                            personSelectionLimit={3}
                                            showtooltip={true}
                                            required={false}
                                            onChange={(items: any[]) => this.setState({ selectedUsers: items })}
                                            showHiddenInUI={false}
                                            principalTypes={[PrincipalType.User]}
                                            resolveDelay={500}
                                        />

                                        <div className={styles.commentActions}>
                                            <button
                                                className={styles.commentBtn}
                                                onClick={() => {
                                                    const names = this.state.selectedUsers.map(u => u.text).join(", ");
                                                    alert(`נבחרו המשתמשים: ${names}`);
                                                    this.setState({ showPeoplePickerPopup: false });
                                                }}
                                            >
                                                שתף
                                            </button>

                                            <button
                                                className={styles.commentCancelBtn}
                                                onClick={() => this.setState({ showPeoplePickerPopup: false })}
                                            >
                                                ביטול
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                    </div>
                </div>
            </>
        );
    }

}