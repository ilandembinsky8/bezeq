import * as React from 'react';
import styles from './TopNav.module.scss';
import { SPFI } from "@pnp/sp";
import { getSP } from "../../PNPConfig/pnpjsConfig";
import { Utilities } from "../Utilities/Utilities";

interface TopNavState {
    searchQuery: string;
    isSearchVisible: boolean;
    isAdmin: boolean;
}

export default class TopNav extends React.Component<{}, TopNavState> {

    private inputRef: React.RefObject<HTMLInputElement>;
    private sp: SPFI;

    constructor(props: {}) {
        super(props);

        this.sp = getSP();
        this.inputRef = React.createRef();

        this.state = {
            searchQuery: '',
            isSearchVisible: false,
            isAdmin: false
        };
    }

    public async componentDidMount(): Promise<void> {
        await this._checkIfUserIsAdmin();
    }

    private _goHomePage(): void {
        window.location.href = '/sites/bmaster';
    }

    private _handleSearch(): void {
        if (this.inputRef.current) {
            const query = this.inputRef.current.value.trim();
            if (query) {
                window.location.href =
                    `https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/SearchResults.aspx?q=${encodeURIComponent(query)}`;
            }
        }
    }

    private _goStatsPage(): void {
        window.location.href =
            'https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/Statistics.aspx';
    }

    private _isOnManagerPage(): boolean {
        return (
            window.location.pathname
                .toLowerCase()
                .indexOf("/sitepages/managerpage.aspx") !== -1
        );
    }

    private _goContactPage(): void {
        window.location.href =
            'https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/ContactUs.aspx';
    }

    private _isOnContactPage(): boolean {
        return (
            window.location.pathname
                .toLowerCase()
                .indexOf("/sitepages/contactus.aspx") !== -1
        );
    }

    private _goPersonalPage(): void {
        window.location.href =
            'https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/PersonalZone.aspx';
    }



    private async _checkIfUserIsAdmin(): Promise<void> {
        try {
            const currentUser = await this.sp.web.currentUser();

            const items = await this.sp.web.lists
                .getByTitle("BmasterAdmins")
                .items
                .select("Id", "admin/Id")
                .expand("admin")
                .filter(`admin/Id eq ${currentUser.Id}`)();

            if (items.length > 0) {
                this.setState({ isAdmin: true });
            }
        } catch (error) {
            console.error("Admin check failed", error);
        }
    }

    public render(): React.ReactElement<{}> {
        return (
            <div className={styles.upperMenu}>

                <div className={styles.logo} onClick={() => this._goHomePage()}>
                    <img
                        src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/logoContact.png"
                        style={{ maxWidth: '100%' }}
                    />
                </div>

                {/* 🔍 SEARCH BAR */}
                <div className={`${styles.search} ${this.state.isSearchVisible ? styles.mobileVisible : ''}`}>
                    <div className={styles.inner}>
                        <div className={styles.micro}></div>

                        <div className={styles.input}>
                            <input
                                type="text"
                                ref={this.inputRef}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        this._handleSearch();
                                    }
                                }}
                            />
                        </div>

                        <div
                            className={styles.magni}
                            onClick={() => this._handleSearch()}
                        ></div>
                    </div>
                </div>

                {/* 🔍 MOBILE SEARCH ICON ONLY */}
                <button
                    className={styles.mobileSearchToggle}
                    type="button"
                    onClick={() =>
                        this.setState({ isSearchVisible: !this.state.isSearchVisible })
                    }
                >
                    <img
                        src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/SEARCH_ICON.png"
                        alt="חיפוש"
                        className={styles.searchIcon}
                    />
                </button>


                <div className={`${styles.slogen} ${this.state.isSearchVisible ? styles.hideOnMobileSearch : ''}`}>
                    {(
                        <button
                            className={styles.managerButton}
                            onClick={() => this._goPersonalPage()}
                            title="האזור האישי"
                        >
                            <img
                                src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/PersonalSpace.png"
                                alt="האזור האישי"
                                className={styles.managerIcon}
                            />
                            <span className={styles.managerText}>אזור אישי</span>
                        </button>
                    )}

                    <button
                        className={styles.managerButton}
                        onClick={() => this._goContactPage()}
                        type="button"
                        title="צור קשר"
                    >
                        <img
                            src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/ContactUs.png"
                            alt="צור קשר"
                            className={styles.managerIcon}
                        />
                        <span className={styles.managerText}>צור קשר</span>
                    </button>


                    <button
                        className={`${styles.managerButton}`}
                        onClick={() => this._goStatsPage()}
                        type="button"
                        title="דוחות"
                    >
                        <img
                            src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/Reports.png"
                            alt="דוחות"
                            className={styles.managerIcon}
                        />
                        <span className={styles.managerText}>דוחות</span>
                    </button>

                </div>
            </div>
        );
    }

}
