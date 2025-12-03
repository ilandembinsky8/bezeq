import * as React from 'react';
import styles from './BPageCount.module.scss';
import type { IBPageCountProps } from './IBPageCountProps';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

const SAP_SITE_URL = 'https://bezeq365.sharepoint.com/sites/SAPLog';
const SAP_LIST_TITLE = 'GetPersData';

type PageType = 'Section' | 'Course';

export default class BPageCount extends React.Component<IBPageCountProps> {

  public componentDidMount(): void {
    (async () => {
      try {
        // 1. קודם כל – ספירת כניסה
        await this.logPageView();
      } catch (err) {
        console.error('BPageCount: failed to log page view', err);
      }
  
      try {
        // 2. עדכון SAPResponse לפריטים שיש להם כבר Tas
        await this.updateSapResponses();
      } catch (err) {
        console.error('BPageCount: failed to update SAP responses', err);
      }
  
      try {
        // 3. השלמת Tas + SAPResponse לפריטים ישנים בלי Tas
        await this.updateMissingTasResponses();
      } catch (err) {
        console.error('BPageCount: failed to backfill TAS & SAP responses', err);
      }
    })();
  }
  

  public render(): React.ReactElement<IBPageCountProps> {
    return (
      <section className={styles.bPageCount}></section>
    );
  }

  
  private async logPageView(): Promise<void> {

    const webUrl = this.props.context.pageContext.web.absoluteUrl;
    const fullUrl = window.location.href;

    const lowerUrl = fullUrl.toLowerCase();

    let pageType: PageType | null = null;
    let idParamName: string | null = null;

    if (lowerUrl.indexOf('courses.aspx') !== -1) {
      pageType = 'Section';
      idParamName = 'SectionID';
    } else if (lowerUrl.indexOf('onecourse.aspx') !== -1) {
      pageType = 'Course';
      idParamName = 'CourseID';
    } else {
      console.debug('BPageCount: not a Courses/OneCourse page, skipping log.');
      return;
    }

    const idStr = this.getQueryStringParam(idParamName);
    if (!idStr) {
      console.warn(`BPageCount: query param ${idParamName} not found, skipping log.`);
      return;
    }

    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      console.warn(`BPageCount: query param ${idParamName} is not a valid number: ${idStr}`);
      return;
    }

    const sourceListTitle = pageType === 'Section' ? 'תחום' : 'קורסים';

    const itemTitle = await this.getItemTitleById(webUrl, sourceListTitle, id);
    if (!itemTitle) {
      console.warn(`BPageCount: could not find item title for list ${sourceListTitle}, Id=${id}`);
      return;
    }

    const userName = this.props.context.pageContext.user.displayName || '';

    const loginName = this.props.context.pageContext.user.loginName || '';

    const tzFromClaims = this.extractTeudatZehutFromClaims(loginName);
    const teudatZehut = tzFromClaims || this.extractTeudatZehutFromUpn(loginName);

    console.log('BPageCount loginName:', loginName, 'TZ parsed:', teudatZehut);

    const pageTypeHebrew = pageType === 'Course' ? 'קורס' : 'תחום';
    const textID = String(id);

    await this.createStatisticsItem(webUrl, {
      Title: itemTitle,
      PageType: pageTypeHebrew,
      UserNameText: userName,
      Link: fullUrl,
      PageID: textID,
      Tas: teudatZehut || ''
    });
  }

  /**
   * ניסיון ראשון – פורמט Claims:
   * i:0#.f|membership|123456789@tenant.com
   */
  private extractTeudatZehutFromClaims(claimsName: string | undefined | null): string | null {
    if (!claimsName) {
      return null;
    }

    try {
      const parts = claimsName.split('|');
      if (parts.length < 3) {
        return null;
      }

      const lastPart = parts[2]; // בד"כ 123456789@tenant.com
      const atIndex = lastPart.indexOf('@');
      if (atIndex === -1) {
        return null;
      }

      const candidate = lastPart.substring(0, atIndex).trim();

      if (!/^\d{8,9}$/.test(candidate)) {
        return null;
      }

      return candidate;
    } catch (e) {
      console.warn('Failed to parse Teudat Zehut from claims:', e, claimsName);
      return null;
    }
  }

  /**
   * ניסיון שני – פורמט UPN פשוט:
   * 30006781@bezeq.com → לוקחים את מה שלפני ה־@
   */
  private extractTeudatZehutFromUpn(upn: string | undefined | null): string | null {
    if (!upn) {
      return null;
    }

    try {
      const atIndex = upn.indexOf('@');
      if (atIndex === -1) {
        return null;
      }

      const candidate = upn.substring(0, atIndex).trim();

      if (!/^\d{8,9}$/.test(candidate)) {
        return null;
      }

      return candidate;
    } catch (e) {
      console.warn('Failed to parse Teudat Zehut from UPN:', e, upn);
      return null;
    }
  }

  private async getItemTitleById(
    webUrl: string,
    listTitle: string,
    id: number
  ): Promise<string | null> {

    const url =
      `${webUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items` +
      `?$select=Id,Title&$filter=Id eq ${id}`;

    const response: SPHttpClientResponse = await this.props.context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      console.error('BPageCount: error getting item title', response.statusText);
      return null;
    }

    const data: any = await response.json();
    if (!data || !data.value || data.value.length === 0) {
      return null;
    }

    return data.value[0].Title || null;
  }

  private async createStatisticsItem(
    webUrl: string,
    data: {
      Title: string;
      PageType: string;
      UserNameText: string;
      Link: string;
      PageID: string;
      Tas?: string | null;
    }
  ): Promise<void> {

    const listTitle = 'BezeqStatistics';
    const url = `${webUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;
    const pageId: string = data.PageID;

    const body: any = {
      Title: data.Title,
      PageType: data.PageType,
      UserNameText: data.UserNameText,
      Link: data.Link,
      PageID: pageId
    };

    if (typeof data.Tas !== 'undefined') {
      body.Tas = data.Tas ?? null;
    }

    const response: SPHttpClientResponse = await this.props.context.spHttpClient.post(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'accept': 'application/json;odata=nometadata',
          'content-type': 'application/json;odata=nometadata',
          'odata-version': ''
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('BPageCount: failed to create BezeqStatistics item', response.status, text);
    } else {
      console.debug('BPageCount: statistics item created successfully.');
    }
  }

  private getQueryStringParam(name: string): string | null {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name);
    return value;
  }

  // ========= חדש: עדכון SAPResponse =========

  private async updateSapResponses(): Promise<void> {
    const webUrl = this.props.context.pageContext.web.absoluteUrl;

const filter = "(Tas ne null) and (Tas ne '') and (GotResponse ne 'YES')";
//const filter = "(Tas ne null) and (Tas ne '') and ((FullName eq null) or (FullName eq ''))";

const statsUrl =
  `${webUrl}/_api/web/lists/getbytitle('BezeqStatistics')/items` +
  `?$select=Id,Tas,GotResponse&$filter=${encodeURIComponent(filter)}&$top=100`;


    const response: SPHttpClientResponse = await this.props.context.spHttpClient.get(
      statsUrl,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      console.error('BPageCount: failed to query BezeqStatistics for SAPResponse update', response.statusText);
      return;
    }

    const data: any = await response.json();
    if (!data || !data.value || data.value.length === 0) {
      return;
    }

    const items: Array<{ Id: number; Tas?: string }> = data.value;

    // קיבוץ לפי Tas כדי לא לקרוא ל-SAPLog כפול
    const tasMap = new Map<string, number[]>();
    for (const item of items) {
      const tas = (item.Tas || '').trim();
      if (!tas) {
        continue;
      }
      const list = tasMap.get(tas) || [];
      list.push(item.Id);
      tasMap.set(tas, list);
    }

    for (const [tas, statItemIds] of tasMap.entries()) {
      try {
        const sapResponse = await this.getOrCreateSapResponseForTas(tas);
        if (!sapResponse) {
          continue;
        }

        // מעדכן את כל פריטי הסטטיסטיקה עם אותו Tas
        await Promise.all(
          statItemIds.map(id =>
            this.updateStatisticsSapResponse(webUrl, id, sapResponse).catch(err => {
              console.error(`BPageCount: failed to update SAPResponse for BezeqStatistics item ${id}`, err);
            })
          )
        );
      } catch (err) {
        console.error(`BPageCount: error while processing Tas ${tas}`, err);
      }
    }
  }

  private async getOrCreateSapResponseForTas(tas: string): Promise<string | null> {
    // קודם: לבדוק אם כבר יש פריט ב-GetPersData עם ה-Tas הזה (בעמודת Title)
    const existing = await this.getLatestSapLogItemByTas(tas);
  
    if (existing) {
      if (existing.Response && existing.Response.trim() !== '') {
        return existing.Response;
      }
  
      // יש פריט אבל בלי Response – מחכים ומעדכנים מאותו פריט
      await this.delay(15000);
      const refreshed = await this.getSapLogItemById(existing.Id);
      if (refreshed && refreshed.Response && refreshed.Response.trim() !== '') {
        return refreshed.Response;
      }
  
      await this.delay(10000);
      const refreshed2 = await this.getSapLogItemById(existing.Id);
      if (refreshed2 && refreshed2.Response && refreshed2.Response.trim() !== '') {
        return refreshed2.Response;
      }
  
      return null;
    }
  
    // אין פריט – ליצור חדש ב-GetPersData
    const createUrl = `${SAP_SITE_URL}/_api/web/lists/getbytitle('${encodeURIComponent(SAP_LIST_TITLE)}')/items`;
  
    const body: any = {
      Title: tas   // ← הת"ז נכנסת לכותרת
      // אם יש שדות נוספים שה-FLOW דורש – להוסיף פה
    };
  
    const createResp: SPHttpClientResponse = await this.props.context.spHttpClient.post(
      createUrl,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'accept': 'application/json;odata=nometadata',
          'content-type': 'application/json;odata=nometadata',
          'odata-version': ''
        },
        body: JSON.stringify(body)
      }
    );
  
    if (!createResp.ok) {
      const text = await createResp.text();
      console.error('BPageCount: failed to create SAP log item (GetPersData)', createResp.status, text);
      return null;
    }
  
    const created: any = await createResp.json();
    const logId: number | undefined = created && created.Id;
  
    if (!logId) {
      console.error('BPageCount: created SAP log item without Id');
      return null;
    }
  
    // מחכים ל-FLOW שימלא את עמודת Response
    await this.delay(15000);
    const logItem = await this.getSapLogItemById(logId);
    if (logItem && logItem.Response && logItem.Response.trim() !== '') {
      return logItem.Response;
    }
  
    await this.delay(10000);
    const logItem2 = await this.getSapLogItemById(logId);
    if (logItem2 && logItem2.Response && logItem2.Response.trim() !== '') {
      return logItem2.Response;
    }
  
    return null;
  }
  
  

  private async getLatestSapLogItemByTas(
    tas: string
  ): Promise<{ Id: number; Title?: string; Response?: string } | null> {
    const tasEscaped = tas.replace(/'/g, "''");
    const filter = `Title eq '${tasEscaped}'`;
    const url =
      `${SAP_SITE_URL}/_api/web/lists/getbytitle('${encodeURIComponent(SAP_LIST_TITLE)}')/items` +
      `?$select=Id,Title,Response&$filter=${encodeURIComponent(filter)}&$orderby=Id desc&$top=1`;
  
    const resp: SPHttpClientResponse = await this.props.context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1
    );
  
    if (!resp.ok) {
      console.error('BPageCount: failed to query GetPersData by Title (Tas)', resp.statusText);
      return null;
    }
  
    const data: any = await resp.json();
    if (!data || !data.value || data.value.length === 0) {
      return null;
    }
  
    const item = data.value[0];
    return {
      Id: item.Id,
      Title: item.Title,
      Response: item.Response
    };
  }
  
  
  private async getSapLogItemById(
    id: number
  ): Promise<{ Id: number; Title?: string; Response?: string } | null> {
    const url =
      `${SAP_SITE_URL}/_api/web/lists/getbytitle('${encodeURIComponent(SAP_LIST_TITLE)}')/items(${id})?$select=Id,Title,Response`;
  
    const resp: SPHttpClientResponse = await this.props.context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1
    );
  
    if (!resp.ok) {
      console.error(`BPageCount: failed to get GetPersData item by Id ${id}`, resp.statusText);
      return null;
    }
  
    const item: any = await resp.json();
    if (!item || typeof item.Id !== 'number') {
      return null;
    }
  
    return {
      Id: item.Id,
      Title: item.Title,
      Response: item.Response
    };
  }
  
  private mapSapResponseToStatsFields(sapResponse: string): any {
    if (!sapResponse) {
      return {};
    }
  
    try {
      const parsed = JSON.parse(sapResponse);
      const personal = parsed?.mt_hrpersonal_res?.PERSONAL_DATA;
      if (!personal) {
        return {};
      }
  
      const result: any = {};
  
      // Full Name
      if (personal.NAME40 && typeof personal.NAME40 === 'string') {
        result.FullName = personal.NAME40;
      } else {
        const last = personal.NACHN || '';
        const first = personal.VORNA || '';
        const full = `${last} ${first}`.trim();
        if (full) result.FullName = full;
      }
  
      // Division (חטיבה)
      if (personal.HATIVA_TXT && typeof personal.HATIVA_TXT === 'string') {
        result.Division = personal.HATIVA_TXT;
      } else if (personal.WERKS_TXT) {
        result.Division = personal.WERKS_TXT;
      }
  
      // Department (אגף)
      if (personal.AGAF_TXT && typeof personal.AGAF_TXT === 'string') {
        result.Department = personal.AGAF_TXT;
      }
  
      // Unit (מחלקה)
      if (personal.MAHLAKA_TXT && typeof personal.MAHLAKA_TXT === 'string') {
        result.Unit = personal.MAHLAKA_TXT;
      }
  
      // Management Level (רמה ניהולית)
      if (personal.STELL_LEVEL_TXT && typeof personal.STELL_LEVEL_TXT === 'string') {
        result.ManagementLevel = personal.STELL_LEVEL_TXT;
      }
  
      return result;
    } catch (e) {
      console.warn('BPageCount: failed to parse SAPResponse JSON', e, sapResponse);
      return {};
    }
  }
  
  private async updateMissingTasResponses(): Promise<void> {
    const webUrl = this.props.context.pageContext.web.absoluteUrl;
  
    const filter = "(GotResponse ne 'YES') and ((Tas eq null) or (Tas eq ''))";
  
    const statsUrl =
      `${webUrl}/_api/web/lists/getbytitle('BezeqStatistics')/items` +
      `?$select=Id,Tas,GotResponse,Author/Name,Author/Title,Author/EMail` +
      `&$expand=Author` +
      `&$filter=${encodeURIComponent(filter)}` +
      `&$top=100`;
  
    const response: SPHttpClientResponse = await this.props.context.spHttpClient.get(
      statsUrl,
      SPHttpClient.configurations.v1
    );
  
    if (!response.ok) {
      console.error('BPageCount: failed to query BezeqStatistics for missing Tas', response.statusText);
      return;
    }
  
    const data: any = await response.json();
    if (!data || !data.value || data.value.length === 0) {
      return;
    }
  
    const items: any[] = data.value;
  
    const tasMap = new Map<string, number[]>();
  
    for (const item of items) {
      const author = item.Author || {};
      const loginLike: string | null =
        author.Name || author.EMail || author.Title || null;
  
      if (!loginLike) {
        continue;
      }
  
      let tas: string | null =
        this.extractTeudatZehutFromClaims(loginLike) ||
        this.extractTeudatZehutFromUpn(loginLike);
  
      if (!tas) {
        continue; 
      }
  
      tas = tas.trim();
      if (!tas) {
        continue;
      }
  
      const list = tasMap.get(tas) || [];
      list.push(item.Id);
      tasMap.set(tas, list);
    }
  
    for (const [tas, statItemIds] of tasMap.entries()) {
      try {
        const sapResponse = await this.getOrCreateSapResponseForTas(tas);
        if (!sapResponse) {
          continue;
        }
  
        await Promise.all(
          statItemIds.map(id =>
            this.updateStatisticsSapResponse(webUrl, id, sapResponse, tas).catch(err => {
              console.error(`BPageCount: failed to update SAPResponse (missing Tas scenario) for item ${id}`, err);
            })
          )
        );
      } catch (err) {
        console.error(`BPageCount: error while processing missing Tas for Tas=${tas}`, err);
      }
    }
  }

  
  private async updateStatisticsSapResponse(
    webUrl: string,
    itemId: number,
    sapResponse: string,
    tas?: string           
  ): Promise<void> {
    const url =
      `${webUrl}/_api/web/lists/getbytitle('BezeqStatistics')/items(${itemId})`;
  
    const extraFields = this.mapSapResponseToStatsFields(sapResponse);
  
    const body: any = {
      SAPResponse: sapResponse,
      GotResponse: "YES",
      ...extraFields
    };
  
    if (tas) {
      body.Tas = tas;
    }
  
    const resp: SPHttpClientResponse = await this.props.context.spHttpClient.post(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'accept': 'application/json;odata=nometadata',
          'content-type': 'application/json;odata=nometadata',
          'odata-version': '',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE'
        },
        body: JSON.stringify(body)
      }
    );
  
    if (!resp.ok) {
      const text = await resp.text();
      console.error(
        `BPageCount: failed to update SAPResponse for BezeqStatistics item ${itemId}`,
        resp.status,
        text
      );
    } else {
      console.debug(
        `***BPageCount: SAPResponse & related fields updated for BezeqStatistics item ${itemId}`
      );
    }
  }
  

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
