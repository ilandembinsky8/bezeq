import * as React from 'react';
import styles from './TopNav.module.scss';

interface TopNavState {
    searchQuery: string;
    isSearchVisible: boolean;
}

export default class TopNav extends React.Component<{}, TopNavState> {

    private inputRef: React.RefObject<HTMLInputElement>;

    constructor(props: {}) {
        super(props);
        this.inputRef = React.createRef();
        this.state = {
            searchQuery: '',
            isSearchVisible: false
        };
    }

    private _goHomePage(): void {
        window.location.href = '/sites/bmaster';
    }

    private _handleSearch(): void {
        if (this.inputRef.current) {
            const query = this.inputRef.current.value.trim();
            if (query) {
                window.location.href = `https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/SearchResults.aspx?q=${encodeURIComponent(query)}`;
            }
        }
    }

    public render(): React.ReactElement<{}> {
        return (
            <div className={styles.upperMenu}>
                <div className={styles.logo} onClick={() => this._goHomePage()}>
                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/LOGO.png" style={{ maxWidth: '100%' }} />
                </div>

                <div className={styles.mobileMenu}>
                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/CATEGORIES_ICON.png" style={{ width: '50%', display: 'none' }} />
                </div>

                <div className={styles.slogen}>
                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/slogen.png" className={styles.imgSlogen} />
                </div>

                <div
                    className={styles.mobileSearch}
                    onClick={() => this.setState({ isSearchVisible: !this.state.isSearchVisible })}
                >
                    <img src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/SEARCH_ICON.png" style={{ width: '50%' }} />
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
                        <div className={styles.magni} onClick={() => this._handleSearch()}></div>
                    </div>
                </div>
            </div>
        );
    }
}
