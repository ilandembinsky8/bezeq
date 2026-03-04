import * as React from "react";
import styles from "./BottomNav.module.scss";

type BottomNavState = {
    isSearchVisible: boolean;
    isBmasterHome: boolean;
};

export default class BottomNav extends React.Component<{}, BottomNavState> {

    constructor(props: {}) {
        super(props);

        this.state = {
            isSearchVisible: false,
            isBmasterHome: this._isOnBmasterHome()
        };
    }

    private _goContactPage = (): void => {
        window.location.href =
            "https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/ContactUs.aspx";
    };

    private _goPersonalPage = (): void => {
        window.location.href =
            "https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/PersonalZone.aspx";
    };

    private _goStatsPage = (): void => {
        window.location.href =
            "https://bezeq365.sharepoint.com/sites/Bmaster/SitePages/Statistics.aspx";
    };

    private _isOnBmasterHome(): boolean {
        const path = window.location.pathname.toLowerCase();
        return path === "/sites/bmaster" || path === "/sites/bmaster/";
    }

    public render(): React.ReactElement<{}> {

        const wrapperStyle = this.state.isBmasterHome
            ? { height: "0px" }
            : undefined;

        return (
            <div
                className={`${styles.actionButtons} ${this.state.isSearchVisible ? styles.hideOnMobileSearch : ""
                    }`}
                style={wrapperStyle}
            >
                <button
                    className={styles.managerButton}
                    onClick={this._goPersonalPage}
                    type="button"
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
                >
                    <img
                        src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/Reports.png"
                        alt="דוחות"
                        className={styles.managerIcon}
                    />
                    <span className={styles.managerText}>דוחות</span>
                </button>
            </div>
        );
    }
}