import * as React from 'react';
import styles from './BPageCount.module.scss';
import type { IBPageCountProps } from './IBPageCountProps';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

type PageType = 'Section' | 'Course';

export default class BPageCount extends React.Component<IBPageCountProps> {

  public componentDidMount(): void {
    this.logPageView().catch((err) => {
      console.error('BPageCount: failed to log page view', err);
    });
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
    
    const pageTypeHebrew = pageType === 'Course' ? 'קורס' : 'תחום';

    const textID = String(id);

    await this.createStatisticsItem(webUrl, {
      Title: itemTitle,
      PageType: pageTypeHebrew,
      UserNameText: userName,
      Link: fullUrl,
      PageID: textID      
    });
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
    }
  ): Promise<void> {
  
    const listTitle = 'BezeqStatistics';
    const url = `${webUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;
    const pageId: string = data.PageID
    
    const body = {
      Title: data.Title,
      PageType: data.PageType,
      UserNameText: data.UserNameText,
      Link: data.Link,
      PageID: pageId
    };
  
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
}
