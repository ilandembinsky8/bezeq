import * as React from 'react';
import styles from './TopNav.module.scss';
import { SPFI, spfi, SPFx } from "@pnp/sp";
// Import only what is needed to reduce errors
import "@pnp/sp/webs";
import "@pnp/sp/site-users";
import "@pnp/sp/lists";
import "@pnp/sp/items";

// This interface fixes the "Property 'context' does not exist" error
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

        // Initialize PnPjs directly from the passed context to fix the SPFI errors
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

    private _handleSearch = (): void => {
        if (this.inputRef.current) {
            const query = this.inputRef.current.value.trim();
            if (query) {
                window.location.href =
                    `https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/SearchResults.aspx?q=${encodeURIComponent(query)}`;
            }
        }
    }

    private async _checkIfUserIsAdmin(): Promise<void> {
        try {
            // This now works because we imported "@pnp/sp/webs" and "@pnp/sp/site-users"
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
                <div className={styles.logo} onClick={() => window.location.href = '/sites/bmaster'}>
                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/LOGO.png" style={{ maxWidth: '100%' }} />
                </div>

                <div className={styles.slogen}>
                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/slogen.png" className={styles.imgSlogen} />
                </div>

                <div className={styles.search}>
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
                        <div className={styles.magni} onClick={() => this._handleSearch()}></div>
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
            </div>
        );
    }
}