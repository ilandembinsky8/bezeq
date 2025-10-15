import * as React from 'react';
import styles from './Sections.module.scss';
//import type { IBmasterProps } from './IBmasterProps';
import { escape } from '@microsoft/sp-lodash-subset';

import { SPFI, spfi } from "@pnp/sp";
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";

import { ICourseSections } from "../Interface/BmasterSPListInterface";
import { Item } from '@pnp/sp/items';

export interface ICoursesSectionProps {
    title?: string;

}


export interface ICoursesSectionState {
    items: ICourseSections[];

}

//xport default class GeographicSearch extends React.Component<IGeographicSearchProps,IGeographicSearchState, {}> {
export default class Sections extends React.Component<ICoursesSectionProps, ICoursesSectionState, {}> {

    private _sp: SPFI;
    private _Utilities: Utilities;

    constructor(props: ICoursesSectionProps) {
        super(props);
        // set initial state
        this.state = {
            items: [],
            // showServiceProvidersDialog:false,
            // showProfessionalsDialog:false,
            // ItemID:null,
            // serviceProviderID:null,
            // showClinicDialog:false,
            // serviceProviderIDPerRowClinic:null,
            // clinicCode:null,
        };
        this._sp = getSP();
        this._Utilities = new Utilities();

        //this.handleCallShowHideModal = this.handleCallShowHideModal.bind(this);
        this._getItems();

    }

    public componentDidMount(): void {
        //

    }


    // private _getItems = async (): Promise<void> => 
    private async _getItems() {
        const items: ICourseSections[] = await this._Utilities._getAllCourseSections();
        this.setState({ items });
        //return ItemsArea;
    }


    public render(): React.ReactElement<{}> {
        // const {
        //   description,
        //   isDarkTheme,
        //   environmentMessage,
        //   hasTeamsContext,
        //   userDisplayName
        // } = this.props;




        //const _items:ICourseSections[] = this.state.items;
        return (
            <>

                <div className={styles.sections}>
                    <div className={styles.inner}>


                        {this.state.items
                            .filter(_item => _item.fieldId === null || _item.fieldId === undefined)
                            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                            .map((_item, i) =>
                                <div id={"s" + i} className={styles.oneItem} style={{ backgroundImage: "url('" + _item.theImage.Url + "')" }} onClick={() => window.location.href = '/sites/Bmaster/SitePages/Courses.aspx?SectionID=' + _item.ID}>
                                    <div className={styles.title}>{_item.addedText}</div>
                                    <div className={styles.text}>{_item.Title}</div>
                                </div>

                            )}
                        {/* <div id="s1" className={styles.oneItem} style={{backgroundImage:"url('https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/pic_all4.png')"}}  onClick={() => window.open('/sites/Bmaster/SitePages/Courses.aspx')}>
                        <div className={styles.text}>עולם העבודה החדש</div>
                    </div> */}
                        {/* <div id="s2" className={styles.oneItem} style={{backgroundImage:"url('https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/pic_all3.png')"}}>
                        <div className={styles.text}>ארגז כלים ניהולי</div>
                    </div>
                    <div id="s3" className={styles.oneItem} style={{backgroundImage:"url('https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/pic_all2.png')"}}>
                        <div className={styles.text}>העשרה ופיתוח אישי</div>
                    </div>
                    <div id="s4" className={styles.oneItem} style={{backgroundImage:"url('https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/pic_all.png')"}}>
                        <div className={styles.text}>קורסים וסדנאות</div>
                    </div> */}
                    </div>
                </div>


            </>


        );
    }
}
