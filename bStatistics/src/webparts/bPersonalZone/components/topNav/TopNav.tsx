import * as React from 'react';
import styles from './TopNav.module.scss';
import { SPFI, spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/site-users";
import "@pnp/sp/lists";
import "@pnp/sp/items";

interface TopNavProps {
    context: any;
}

interface TopNavState {
    isSearchVisible: boolean;
    isAdmin: boolean;
}

export default class TopNav extends React.Component<TopNavProps, TopNavState> {
    private inputRef: React.RefObject<HTMLInputElement>;
    private _sp: SPFI;

    constructor(props: TopNavProps) {
        super(props);

        this._sp = spfi().using(SPFx(this.props.context));
        this.inputRef = React.createRef();

        this.state = {
            isSearchVisible: false,
            isAdmin: false
        };
    }

    public async componentDidMount(): Promise<void> {
        await this._checkIfUserIsAdmin();
    }

    private _goHomePage = (): void => {
        window.location.href = '/sites/bmaster';
    }

    private _handleSearch = (): void => {
        if (this.inputRef.current) {
            const query = this.inputRef.current.value.trim();
            if (query) {
                window.location.href =
                    `https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/SearchResults.aspx?q=${encodeURIComponent(query)}`;
            }
        }
    }

    private _goStatsPage = (): void => {
        window.location.href =
            'https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/Statistics.aspx';
    }

    private _goContactPage = (): void => {
        window.location.href =
            'https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/ContactUs.aspx';
    }

    private _goPersonalPage = (): void => {
        window.location.href =
            'https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/PersonalZone.aspx';
    }

    private async _checkIfUserIsAdmin(): Promise<void> {
        try {
            const currentUser = await this._sp.web.currentUser();

            const items = await this._sp.web.lists
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

    public render(): React.ReactElement<TopNavProps> {
        return (
            <div className={styles.upperMenu}>
                <div className={styles.logo} onClick={this._goHomePage}>
                    <img
                        src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/logoContact.png"
                        style={{ maxWidth: '100%' }}
                    />
                </div>

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
                            onClick={this._handleSearch}
                        ></div>
                    </div>
                </div>

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
                    <button
                        className={styles.managerButton}
                        onClick={this._goPersonalPage}
                        type="button"
                        title="האזור האישי"
                    >
                        <img
                            src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/PersonalSpace.png"
                            alt="האזור האישי"
                            className={styles.managerIcon}
                        />
                        <span className={styles.managerText}>אזור אישי</span>
                    </button>

                    <button
                        className={styles.managerButton}
                        onClick={this._goContactPage}
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
                        className={styles.managerButton}
                        onClick={this._goStatsPage}
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

                    {this.state.isAdmin && (
                        <button
                            className={styles.managerButton}
                            onClick={() => window.location.href = 'https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/ManagerPage.aspx'}
                            type="button"
                        >
                            <span>דף מנהל</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }
}