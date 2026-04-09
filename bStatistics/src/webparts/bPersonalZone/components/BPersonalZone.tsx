import * as React from 'react';
import styles from './BPersonalZone.module.scss';
import type { IBPersonalZoneProps } from './IBPersonalZoneProps';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import TopNav from './topNav/TopNav';

const LIST_TITLE = 'BezeqStatistics';
const CLICKED_AT_FIELD = 'Created';
const COURSES_LIST_TITLE = 'קורסים';
const COURSE_PHOTOS_LIBRARY = 'תמונות קורסים';
const CYCLES_LIST_TITLE = 'מחזורים';
const CYCLE_START_DATE_FIELD = 'startDate';

const PAGE_ID_FIELD = 'PageID';
const PAGE_TYPE_FIELD = 'PageType';

const CYCLE_COURSE_NAME_FIELD = 'courseName';

// כתובות הדפים
const DOMAIN_PAGE_RELATIVE_URL = '/SitePages/Courses.aspx';
const COURSE_PAGE_RELATIVE_URL = '/SitePages/OneCourse.aspx';

// שמות הפרמטרים ב-QueryString
const DOMAIN_QUERY_PARAM = 'SectionID';
const COURSE_QUERY_PARAM = 'CourseID';

// כמות פריטים ברירת מחדל בתצוגה המקוצרת
const INITIAL_VISIBLE_ITEMS = 4;

// ==== TYPES ====

type RawStatItem = {
  Id: number;
  Title?: string;
  Link?: string;
  Created?: any;
  Modified?: string;
  Author?: { Id: number };
  PageID?: number;
  PageType?: string;
  [key: string]: any;
};

type PageRef = {
  type: 'domain' | 'course';
  id: number;
};

type DedupedVisit = {
  title: string;
  url: string;
  lastVisited: Date;
  ref?: PageRef | null;
};

type TopTitle = {
  title: string;
  count: number;
  link?: string;
  courseId?: number;
  photoUrl?: string;
  isVideo?: boolean;
};

type CourseMapItem = {
  id: number;
  courseTitle: string;
  isVideo: boolean;
  sectionTitle?: string;
  sectionId?: number;
  visitsCount: number;
  link?: string;
};

type State = {
  loading: boolean;
  error?: string;
  items: DedupedVisit[];
  recommendations: DedupedVisit[];
  topTitles: TopTitle[];
  showAllRecent: boolean;
  showAllRecommendations: boolean;
};

export default class BPersonalZone extends React.Component<IBPersonalZoneProps, State> {
  public state: State = {
    loading: true,
    items: [],
    recommendations: [],
    topTitles: [],
    showAllRecent: false,
    showAllRecommendations: false
  };

  public componentDidMount(): void {
    this.loadData().catch(err =>
      this.setState({ loading: false, error: (err as Error).message || 'Load error' })
    );
  }

  private async getSmallCoursePhotosByCourseIds(courseIds: number[]): Promise<Map<number, string>> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;

    const cleanIds = Array.from(new Set(courseIds.filter(Boolean)));
    if (cleanIds.length === 0) return new Map<number, string>();

    const url = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${COURSE_PHOTOS_LIBRARY}')/items` +
      `?$select=Id,FileRef,courseName/Id` +
      `&$expand=courseName` +
      `&$filter=photoType eq 'תמונה קטנה'` +
      `&$top=5000`
    );

    const resp: SPHttpClientResponse = await context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1
    );

    if (!resp.ok) return new Map<number, string>();

    const json: any = await resp.json();
    const map = new Map<number, string>();

    for (const r of json.value || []) {
      const cid = r.courseName?.Id;
      if (cid && !map.has(cid)) {
        map.set(cid, r.FileRef);
      }
    }

    return map;
  }

  private async fetchAllItems(apiUrl: string): Promise<any[]> {
    const { context } = this.props;
    let nextUrl: string | undefined = apiUrl;
    const allItems: any[] = [];

    while (nextUrl) {
      const resp: SPHttpClientResponse = await context.spHttpClient.get(
        nextUrl,
        SPHttpClient.configurations.v1
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to load items: ${resp.status} - ${text}`);
      }

      const json: any = await resp.json();
      const currentItems: any[] = json?.value || json?.d?.results || [];
      allItems.push(...currentItems);

      nextUrl = json?.['@odata.nextLink'] || json?.d?.__next;
    }

    return allItems;
  }

  private async loadData(): Promise<void> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;

    const meResp: SPHttpClientResponse = await context.spHttpClient.get(
      `${webUrl}/_api/web/currentuser`,
      SPHttpClient.configurations.v1
    );

    if (!meResp.ok) {
      throw new Error(`Failed to get current user (${meResp.status})`);
    }

    const me: any = await meResp.json();
    const myId: number = me?.Id;

    if (!myId) {
      throw new Error('Cannot resolve current user id');
    }

    // דפים אחרונים + מומלצים = לפי המשתמש
    const userStatsUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
      `?$select=Id,Title,Link,Created,Modified,Author/Id,${PAGE_ID_FIELD},${PAGE_TYPE_FIELD}` +
      `&$expand=Author` +
      `&$filter=Author/Id eq ${myId}` +
      `&$orderby=Created desc` +
      `&$top=5000`
    );

    const rows: RawStatItem[] = await this.fetchAllItems(userStatsUrl);

    // הכי נצפים = גלובלי, רק קורסים
    const globalCourseStatsUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
      `?$select=Id,Title,Link,Created,Modified,${PAGE_ID_FIELD},${PAGE_TYPE_FIELD}` +
      `&$filter=${PAGE_TYPE_FIELD} eq 'קורס'` +
      `&$orderby=Created desc` +
      `&$top=5000`
    );

    const globalCourseRows: RawStatItem[] = await this.fetchAllItems(globalCourseStatsUrl);

    // קורסים שיש להם לפחות מחזור עתידי אחד
    const futureCourseTitleSet = await this.getFutureCourseTitleSet();

    // כל הקורסים מרשימת קורסים + נתונים משלימים
    const courseTitleToId = await this.buildCourseTitleToIdMap();

    debugger;

    // סט ביניים: רק כותרות שנמצאות גם ברשימת קורסים וגם ברשימת מחזורים עתידיים
    const validCourseTitles = new Set<string>(
      Array.from(courseTitleToId.keys()).filter(titleKey => futureCourseTitleSet.has(titleKey))
    );

    debugger
    const futureCourseStats = globalCourseRows.filter(r => {
      const titleKey = this.normalizeTitle(r.Title || '');
      return !!titleKey && validCourseTitles.has(titleKey);
    });

    debugger
    const topTitles = this.getTopTitles(futureCourseStats, 3);

    debugger
    for (const t of topTitles) {
      const key = this.normalizeTitle(t.title);
      const courseData = courseTitleToId.get(key);

      if (courseData) {
        t.courseId = courseData.id;
        t.isVideo = courseData.isVideo;

        if (!t.link && courseData.link) {
          t.link = courseData.link;
        }
      }
    }

    const courseIds = topTitles
      .map(t => t.courseId)
      .filter((id): id is number => !!id);

    const coursePhotoMap = await this.getSmallCoursePhotosByCourseIds(courseIds);

    topTitles.forEach(t => {
      if (t.courseId) {
        t.photoUrl = coursePhotoMap.get(t.courseId);
      }
    });

    // דפים אחרונים
    const seen = new Set<string>();
    const deduped: DedupedVisit[] = [];

    for (const r of rows) {
      const rawPageId = (r as any)[PAGE_ID_FIELD] as number | undefined;
      const rawPageType = ((r as any)[PAGE_TYPE_FIELD] as string | undefined)?.trim();

      let ref: PageRef | null = null;

      if (rawPageId && rawPageType) {
        if (rawPageType === 'תחום') {
          ref = { type: 'domain', id: rawPageId };
        } else if (rawPageType === 'קורס') {
          ref = { type: 'course', id: rawPageId };
        }
      }

      const rawUrl = (r.Link || '').trim();
      const url = rawUrl || (ref ? this.buildPageUrl(ref) : '');
      const rawTitle = (r.Title || '').trim();

      if (!rawTitle && !url) continue;

      const key =
        rawTitle
          ? this.normalizeTitle(rawTitle)
          : ref
            ? `${ref.type}:${ref.id}`
            : this.normalizeUrlForKey(url);

      if (seen.has(key)) continue;
      seen.add(key);

      deduped.push({
        url: url || '',
        title: rawTitle || url || '(ללא כותרת)',
        lastVisited: this.getVisitDate(r),
        ref
      });
    }

    deduped.sort((a, b) => b.lastVisited.getTime() - a.lastVisited.getTime());

    const recommendations = await this.buildRecommendations(deduped);

    this.setState({
      loading: false,
      items: deduped,
      recommendations,
      topTitles
    });
  }

  private async getFutureCourseTitleSet(): Promise<Set<string>> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const cyclesUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${CYCLES_LIST_TITLE}')/items` +
      `?$select=Id,${CYCLE_START_DATE_FIELD},${CYCLE_COURSE_NAME_FIELD}/Id,${CYCLE_COURSE_NAME_FIELD}/Title` +
      `&$expand=${CYCLE_COURSE_NAME_FIELD}` +
      `&$top=5000`
    );
  
    const cycleRows: any[] = await this.fetchAllItems(cyclesUrl);
    const titleSet = new Set<string>();
  
    for (const row of cycleRows) {
      const title = (row?.[CYCLE_COURSE_NAME_FIELD]?.Title || '').trim();
      const rawDate = row?.[CYCLE_START_DATE_FIELD];
  
      if (!title || !rawDate) continue;
  
      const startDate = new Date(rawDate);
      if (isNaN(startDate.getTime())) continue;
  
      startDate.setHours(0, 0, 0, 0);
  
      if (startDate >= today) {
        titleSet.add(this.normalizeTitle(title));
      }
    }
  
    return titleSet;
  }

  private async buildRecommendations(
    recent: DedupedVisit[]
  ): Promise<DedupedVisit[]> {
    const recentCourses = recent
      .filter(r => r.ref?.type === 'course')
      .slice(0, 5);

    if (recentCourses.length === 0) return [];

    const courseMap = await this.buildCourseTitleToIdMap();
    const recentTitleSet = new Set(recent.map(r => this.normalizeTitle(r.title)));
    const sectionCount = new Map<number, number>();

    for (const r of recentCourses) {
      const course = courseMap.get(this.normalizeTitle(r.title));
      if (!course?.sectionId) continue;

      sectionCount.set(
        course.sectionId,
        (sectionCount.get(course.sectionId) || 0) + 1
      );
    }

    if (sectionCount.size === 0) return [];

    const dominantSectionId =
      Array.from(sectionCount.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

    const topCourses =
      Array.from(courseMap.values())
        .filter(c => c.sectionId === dominantSectionId)
        .filter(c => !recentTitleSet.has(this.normalizeTitle(c.courseTitle)))
        .sort((a, b) => b.visitsCount - a.visitsCount)
        .slice(0, 20);

    return topCourses.map(c => ({
      title: c.courseTitle,
      url: c.link || this.buildPageUrl({ type: 'course', id: c.id }),
      lastVisited: new Date()
    }));
  }

  private normalizeTitle(title: string): string {
    return String(title || '')
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[–—−]/g, '-')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private async buildCourseTitleToIdMap(): Promise<Map<string, CourseMapItem>> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;

    const statsUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
      `?$select=Title,Link,Created,PageType` +
      `&$filter=PageType eq 'קורס'` +
      `&$orderby=Created desc` +
      `&$top=5000`
    );

    const statsRows: any[] = await this.fetchAllItems(statsUrl);

    const visitsCountByTitle = new Map<string, number>();
    const linkByTitle = new Map<string, string>();

    for (const row of statsRows) {
      const title = (row.Title || '').trim();
      if (!title) continue;

      const key = this.normalizeTitle(title);

      visitsCountByTitle.set(
        key,
        (visitsCountByTitle.get(key) || 0) + 1
      );

      const link = (row.Link || '').trim();
      if (link && !linkByTitle.has(key)) {
        linkByTitle.set(key, link);
      }
    }

    const coursesUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${COURSES_LIST_TITLE}')/items` +
      `?$select=Id,Title,isVideo,theSection/Id,theSection/Title` +
      `&$expand=theSection` +
      `&$top=5000`
    );

    const courseRows: any[] = await this.fetchAllItems(coursesUrl);
    const map = new Map<string, CourseMapItem>();

    for (const row of courseRows) {
      if (!row.Title || !row.Id) continue;

      const key = this.normalizeTitle(row.Title);
      const visitsCount = visitsCountByTitle.get(key) || 0;

      map.set(key, {
        id: row.Id,
        courseTitle: row.Title,
        isVideo: !!row.isVideo,
        sectionId: row.theSection?.Id,
        sectionTitle: row.theSection?.Title,
        visitsCount,
        link: linkByTitle.get(key)
      });
    }

    return map;
  }

  private getTopTitles(rows: RawStatItem[], limit: number): TopTitle[] {
    const counts = new Map<string, TopTitle>();

    for (const r of rows) {
      const title = (r.Title || '').trim();
      if (!title) continue;

      const key = this.normalizeTitle(title);
      const existing = counts.get(key);

      if (existing) {
        existing.count += 1;

        if (!existing.link) {
          const currentLink = (r.Link || '').trim();
          if (currentLink) {
            existing.link = currentLink;
          }
        }
      } else {
        counts.set(key, {
          title,
          count: 1,
          link: (r.Link || '').trim()
        });
      }
    }

    return Array.from(counts.values())
      .sort((a, b) => (b.count - a.count) || a.title.localeCompare(b.title))
      .slice(0, limit);
  }

  private buildPageUrl(ref: PageRef): string {
    const base = this.props.context.pageContext.web.absoluteUrl.replace(/\/$/, '');
    const isDomain = ref.type === 'domain';
    const pagePath = isDomain ? DOMAIN_PAGE_RELATIVE_URL : COURSE_PAGE_RELATIVE_URL;
    const paramName = isDomain ? DOMAIN_QUERY_PARAM : COURSE_QUERY_PARAM;
    const separator = pagePath.indexOf('?') >= 0 ? '&' : '?';

    return `${base}${pagePath}${separator}${paramName}=${encodeURIComponent(ref.id.toString())}`;
  }

  private normalizeUrlForKey(rawUrl: string): string {
    const base = this.props.context.pageContext.web.absoluteUrl;

    try {
      const u = new URL(rawUrl.trim(), base);
      let protocol = u.protocol.toLowerCase();
      let host = u.hostname.toLowerCase();
      let port = u.port;

      if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) {
        port = '';
      }

      let pathname = u.pathname;
      if (pathname !== '/' && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }

      return `${protocol}//${host}${port ? ':' + port : ''}${pathname}${u.search}${u.hash}`;
    } catch {
      return rawUrl.trim().toLowerCase();
    }
  }

  private formatDate(d: Date): string {
    const now = new Date();
    const isSameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (isSameDay) return `היום ${d.toLocaleTimeString()}`;
    if (d.toDateString() === yesterday.toDateString()) return `אתמול ${d.toLocaleTimeString()}`;
    return d.toLocaleString();
  }

  private getVisitDate(row: RawStatItem): Date {
    const raw = (row as any)[CLICKED_AT_FIELD];

    if (typeof raw === 'string' && !isNaN(Date.parse(raw))) {
      return new Date(raw);
    }

    if (row.Modified && !isNaN(Date.parse(row.Modified))) {
      return new Date(row.Modified);
    }

    if (typeof row.Created === 'string' && !isNaN(Date.parse(row.Created))) {
      return new Date(row.Created);
    }

    return new Date(0);
  }

  public render(): React.ReactElement<IBPersonalZoneProps> {
    const {
      loading,
      error,
      items,
      recommendations,
      topTitles,
      showAllRecent,
      showAllRecommendations
    } = this.state;

    const visibleRecent = showAllRecent ? items : items.slice(0, INITIAL_VISIBLE_ITEMS);
    const visibleRecommendations = showAllRecommendations
      ? recommendations
      : recommendations.slice(0, INITIAL_VISIBLE_ITEMS);

    return (
      <section className={styles.bPersonalZone}>
        <TopNav context={this.props.context} />

        <div className={styles.pageHeader}>
          <div className={styles.courseTitle}>האזור האישי</div>
          <div className={styles.topSeperator}></div>
        </div>

        <div className={styles.pageLayout}>
          <div className={styles.rightColumn}>
            <div className={styles.header3}>
              איזור אישי
            </div>
            <img
              className={styles.astronaut}
              src="https://bezeq365.sharepoint.com/sites/Bmaster/SiteAssets/Bmaster/cut/astronaut.png"
              alt=""
            />
          </div>

          <div className={styles.centerColumn}>
            <div className={styles.centerInner}>
              <div className={styles.header2}>דפים אחרונים</div>

              {loading && <div className={styles.info}>טוען…</div>}
              {error && <div className={styles.error}>שגיאה: {error}</div>}

              {!loading && !error && items.length === 0 && (
                <div className={styles.info}>אין עדיין כניסות להצגה.</div>
              )}

              {!loading && !error && items.length > 0 && (
                <>
                  <ul className={styles.list}>
                    {visibleRecent.map((it, idx) => (
                      <li key={idx} className={styles.item}>
                        <a href={it.url} className={styles.link} target="_self" rel="noopener">
                          <span className={styles.title}>{it.title}</span>
                          <span className={styles.meta}>{this.formatDate(it.lastVisited)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>

                  {items.length > INITIAL_VISIBLE_ITEMS && !showAllRecent && (
                    <button
                      type="button"
                      className={styles.expandButton}
                      onClick={() => this.setState({ showAllRecent: true })}
                    >
                      <span className={styles.expandIcon}>&#x229E;</span>
                      <span>להרחבה</span>
                    </button>
                  )}
                </>
              )}

              {!loading && !error && (
                <>
                  <div className={styles.header4}>
                    דפים מומלצים
                  </div>

                  {recommendations.length === 0 ? (
                    <div className={styles.info}>אין המלצות כרגע.</div>
                  ) : (
                    <>
                      <ul className={styles.list}>
                        {visibleRecommendations.map((it, idx) => (
                          <li key={`rec-${idx}`} className={styles.item}>
                            <a href={it.url} className={styles.link} target="_self" rel="noopener">
                              <span className={styles.title}>{it.title}</span>
                            </a>
                          </li>
                        ))}
                      </ul>

                      {recommendations.length > INITIAL_VISIBLE_ITEMS && !showAllRecommendations && (
                        <button
                          type="button"
                          className={styles.expandButton}
                          onClick={() => this.setState({ showAllRecommendations: true })}
                        >
                          <span className={styles.expandIcon}>&#x229E;</span>
                          <span>להרחבה</span>
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={styles.leftColumn}>
            <div className={styles.header2}>
              הכי נצפים
            </div>

            {!loading && !error && topTitles.length > 0 && (
              <div className={styles.coursesContainer}>
                {topTitles
                  .filter(t => t.link || t.courseId)
                  .map((t, idx) => (
                    <div
                      key={`${t.title}-${idx}`}
                      className={styles.oneCourse}
                      style={{
                        backgroundImage: t.photoUrl ? `url('${t.photoUrl}')` : undefined
                      }}
                      onClick={() => {
                        if (t.link) {
                          window.location.href = t.link;
                          return;
                        }

                        if (!t.courseId) return;

                        if (t.isVideo) {
                          window.location.href =
                            `/sites/Bmaster/SitePages/VideoPage.aspx?CourseID=${t.courseId}`;
                        } else {
                          window.location.href =
                            `/sites/Bmaster/SitePages/OneCourse.aspx?CourseID=${t.courseId}`;
                        }
                      }}
                    >
                      <div className={styles.courseName}>
                        {t.title}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
}