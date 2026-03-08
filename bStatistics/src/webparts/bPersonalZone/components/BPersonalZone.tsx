import * as React from 'react';
import styles from './BPersonalZone.module.scss';
import type { IBPersonalZoneProps } from './IBPersonalZoneProps';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import TopNav from './topNav/TopNav';

// ==== CONFIG – להתאים לפי הסביבה שלך ====

// רשימת הסטטיסטיקות
const LIST_TITLE = 'BezeqStatistics';
// User field that stores the clicked user (update if internal name differs)

//const CLICK_USER_FIELD = 'Author';

// Date field for visit time (fallback to Modified if not a valid date)
const CLICKED_AT_FIELD = 'Created';

// רשימות מקור הדפים
// const DOMAINS_LIST_TITLE = 'תחום';      // רשימת התחומים
const COURSES_LIST_TITLE = 'קורסים';    // רשימת הקורסים
const COURSE_PHOTOS_LIBRARY = 'תמונות קורסים';

// שם השדה של מילות המפתח בשתי הרשימות
// const KEYWORDS_FIELD = 'KeyWords';

// עמודות מזהות דף ב-BezeqStatistics
const PAGE_ID_FIELD = 'PageID';         // מספר ה-ID ברשימת תחום/קורסים
const PAGE_TYPE_FIELD = 'PageType';     // "תחום" / "קורס"

// כתובות הדפים
const DOMAIN_PAGE_RELATIVE_URL = '/SitePages/Courses.aspx';
const COURSE_PAGE_RELATIVE_URL = '/SitePages/OneCourse.aspx';

// שמות הפרמטרים ב-QueryString
const DOMAIN_QUERY_PARAM = 'SectionID';
const COURSE_QUERY_PARAM = 'CourseID';

// כמות פריטים
const MAX_ITEMS = 4;
// const TOP_VISITS_FOR_RECS = 5;
// const MAX_RECOMMENDED = 2;

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
  courseId?: number;
  photoUrl?: string;
  isVideo?: boolean;
};

// type SourceItem = PageRef & {
//   title: string;
//   keywordsRaw: string;
// };


type State = {
  loading: boolean;
  error?: string;
  items: DedupedVisit[];
  recommendations: DedupedVisit[];
  topTitles: TopTitle[];
};

export default class BPersonalZone extends React.Component<IBPersonalZoneProps, State> {
  public state: State = { loading: true, items: [], recommendations: [], topTitles: [] };

  public componentDidMount(): void {
    this.loadData().catch(err =>
      this.setState({ loading: false, error: (err as Error).message || 'Load error' })
    );
  }

  private async getSmallCoursePhotosByCourseIds(courseIds: number[]): Promise<Map<number, string>> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;

    const cleanIds = Array.from(new Set(courseIds.filter(Boolean)));
    if (cleanIds.length === 0) return new Map();

    // Build (courseName/Id eq X or courseName/Id eq Y)
    // const idFilter = cleanIds.map(id => `courseName/Id eq ${id}`).join(' or ');

    const url = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${COURSE_PHOTOS_LIBRARY}')/items` +
      `?$select=Id,FileRef,courseName/Id` +
      `&$expand=courseName` +
      // `&$filter=photoType eq 'תמונה קטנה' and (${idFilter})` +
      `&$filter=photoType eq 'תמונה קטנה'` +
      `&$top=5000`
    );

    const resp = await context.spHttpClient.get(
      url,
      SPHttpClient.configurations.v1
    );

    if (!resp.ok) return new Map();

    const json = await resp.json();
    const map = new Map<number, string>();

    for (const r of json.value || []) {
      const cid = r.courseName?.Id;
      if (cid && !map.has(cid)) {
        map.set(cid, r.FileRef); // one photo per course
      }
    }

    return map;
  }



  // ================== LOAD MAIN DATA ==================

  private async loadData(): Promise<void> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;

    // --- current user ---
    const meResp = await context.spHttpClient.get(
      `${webUrl}/_api/web/currentuser`,
      SPHttpClient.configurations.v1
    );
    if (!meResp.ok) throw new Error(`Failed to get current user (${meResp.status})`);
    const me = await meResp.json();
    const myId: number = me?.Id;
    if (!myId) throw new Error('Cannot resolve current user id');

    // --- load last visits from BezeqStatistics ---
    const select = `$select=Id,Title,Link,Created,Author/Id,${PAGE_ID_FIELD},${PAGE_TYPE_FIELD}`;
    const expand = `$expand=Author`;
    const filter = `$filter=Author/Id eq ${myId}`;
    const orderby = `$orderby=Created desc`;
    const top = `$top=500`;
    const apiUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items?${select}&${expand}&${filter}&${orderby}&${top}`
    );

    const listResp: SPHttpClientResponse = await context.spHttpClient.get(
      apiUrl,
      SPHttpClient.configurations.v1
    );
    if (!listResp.ok) {
      const text = await listResp.text();
      throw new Error(`Failed to load list items: ${listResp.status} - ${text}`);
    }
    const data = await listResp.json();
    const rows: RawStatItem[] = data?.value || [];
    const topTitles = this.getTopTitles(rows, 3);
    const courseTitleToId = await this.buildCourseTitleToIdMap();

    for (const t of topTitles) {
      const key = this.normalizeTitle(t.title);
      const courseData = courseTitleToId.get(key);
      if (courseData) {
        t.courseId = courseData.id;
        t.isVideo = courseData.isVideo;
      }

    }
    console.log('Top titles with course IDs:', topTitles);
    const courseIds = topTitles
      .map(t => t.courseId)
      .filter((id): id is number => !!id);

    const coursePhotoMap = await this.getSmallCoursePhotosByCourseIds(courseIds);

    // attach photo URL to topTitles
    topTitles.forEach(t => {
      if (t.courseId) {
        (t as any).photoUrl = coursePhotoMap.get(t.courseId);
      }
    });


    // --- דה־דופ לפי כותרת (primary), ואם אין – לפי type+id או URL ---
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
      const url = ref
        ? this.buildPageUrl(ref)
        : rawUrl;

      const rawTitle = (r.Title || '').trim();

      // אם אין לא כותרת ולא URL – אין מה להציג
      if (!rawTitle && !url) continue;

      // מפתח דה־דופ:
      // 1. קודם כל לפי כותרת (case-insensitive)
      // 2. אם אין כותרת – לפי type+id
      // 3. ואם גם זה אין – לפי URL מנורמל
      const key =
        rawTitle
          ? rawTitle.toLowerCase()
          : ref
            ? `${ref.type}:${ref.id}`
            : this.normalizeUrlForKey(url);

      if (seen.has(key)) continue;
      seen.add(key);

      deduped.push({
        url: url || '',
        title: rawTitle || url || '(ללא כותרת)',
        lastVisited: this.getVisitDate(r),
        ref,
      });

      if (deduped.length >= MAX_ITEMS) break;
    }

    deduped.sort((a, b) => b.lastVisited.getTime() - a.lastVisited.getTime());

    const recommendations = await this.buildRecommendations(deduped);

    this.setState({ loading: false, items: deduped, recommendations, topTitles });
  }


  // ================== RECOMMENDATIONS ==================

  private async buildRecommendations(
    recent: DedupedVisit[]
  ): Promise<DedupedVisit[]> {

    // 1. קח רק 5 כניסות אחרונות של קורסים
    const recentCourses = recent
      .filter(r => r.ref?.type === 'course')
      .slice(0, 5);

    if (recentCourses.length === 0) return [];

    // 2. מפת הקורסים (כוללת section + visits)
    const courseMap = await this.buildCourseTitleToIdMap();

    // 3. ספור הופעות של תחומים
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

    // 4. התחום הדומיננטי
    const dominantSectionId =
      Array.from(sectionCount.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

    // 5. שני הקורסים הכי נצפים באותו תחום
    const topCourses =
      Array.from(courseMap.values())
        .filter(c => c.sectionId === dominantSectionId)
        .sort((a, b) => b.visitsCount - a.visitsCount)
        .slice(0, 2);

    // 6. החזרה בפורמט DedupedVisit
    return topCourses.map(c => ({
      title: c.courseTitle,
      url: this.buildPageUrl({ type: 'course', id: c.id }),
      lastVisited: new Date()
    }));
  }


  // ================== HELPERS – DATA FROM LISTS ==================

  private normalizeTitle(title: string): string {
    return title
      .trim()
      .toLowerCase()
      .replace(/[–—−]/g, '-') // מקפים חכמים
      .replace(/\s+/g, ' ');  // רווחים כפולים
  }

  private async buildCourseTitleToIdMap(): Promise<
    Map<
      string,
      {
        id: number;
        courseTitle: string;   // ✅ חובה
        isVideo: boolean;
        sectionTitle?: string;
        sectionId?: number;
        visitsCount: number;
      }
    >
  > {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;

    // ===============================
    // 1. Load visits from BezeqStatistics
    // ===============================
    const statsUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${LIST_TITLE}')/items` +
      `?$select=PageID,PageType` +
      `&$top=5000`
    );

    const statsResp = await context.spHttpClient.get(
      statsUrl,
      SPHttpClient.configurations.v1
    );

    const visitsCountByCourseId = new Map<number, number>();

    if (statsResp.ok) {
      const statsJson = await statsResp.json();

      for (const row of statsJson.value || []) {
        const pageType = (row.PageType || '').trim();
        if (pageType !== 'קורס') continue;

        const courseId = Number(row.PageID);
        if (!courseId || isNaN(courseId)) continue;

        visitsCountByCourseId.set(
          courseId,
          (visitsCountByCourseId.get(courseId) || 0) + 1
        );
      }
    }

    console.log('Visits map size:', visitsCountByCourseId.size);

    // ===============================
    // 2. Load courses list
    // ===============================
    const coursesUrl = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${COURSES_LIST_TITLE}')/items` +
      `?$select=Id,Title,isVideo,theSection/Id,theSection/Title` +
      `&$expand=theSection` +
      `&$top=5000`
    );

    const resp = await context.spHttpClient.get(
      coursesUrl,
      SPHttpClient.configurations.v1
    );

    if (!resp.ok) return new Map();

    const json = await resp.json();
    const map = new Map<
      string,
      {
        id: number;
        courseTitle: string;   // ✅ להוסיף כאן
        isVideo: boolean;
        sectionTitle?: string;
        sectionId?: number;
        visitsCount: number;
      }
    >();

    // ===============================
    // 3. Build map: Title → Course data
    // ===============================
    for (const row of json.value || []) {
      if (!row.Title || !row.Id) continue;

      const sectionTitle = row.theSection?.Title;
      const visitsCount = visitsCountByCourseId.get(row.Id) || 0;

      map.set(this.normalizeTitle(row.Title), {
        id: row.Id,
        courseTitle: row.Title,   // ← להוסיף
        isVideo: !!row.isVideo,
        sectionId: row.theSection?.Id,
        sectionTitle: row.theSection?.Title,
        visitsCount
      });



      // DEBUG – verify match
      if (visitsCount > 0) {
        console.log('COURSE VISITS MATCH', {
          courseId: row.Id,
          title: row.Title,
          sectionTitle,
          visitsCount
        });
      }
    }

    return map;
  }




  // ================== URL / KEYWORDS HELPERS ==================

  // private chunk<T>(arr: T[], size: number): T[][] {
  //   const out: T[][] = [];
  //   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  //   return out;
  // }

  // private parseKeywords(raw: string): string[] {
  //   return raw
  //     .split(/[;|,]/)
  //     .map(s => s.trim().toLowerCase())
  //     .filter(Boolean);
  // }

  private buildPageUrl(ref: PageRef): string {
    const base = this.props.context.pageContext.web.absoluteUrl.replace(/\/$/, '');
    const isDomain = ref.type === 'domain';
    const pagePath = isDomain ? DOMAIN_PAGE_RELATIVE_URL : COURSE_PAGE_RELATIVE_URL;
    const paramName = isDomain ? DOMAIN_QUERY_PARAM : COURSE_QUERY_PARAM;
    const separator = pagePath.indexOf('?') >= 0 ? '&' : '?';
    return `${base}${pagePath}${separator}${paramName}=${encodeURIComponent(ref.id.toString())}`;
  }

  // private parsePageRefFromUrl(rawUrl: string): PageRef | null {
  //   const base = this.props.context.pageContext.web.absoluteUrl;
  //   try {
  //     const u = new URL(rawUrl.trim(), base);
  //     const pathname = u.pathname.toLowerCase();

  //     const isDomain = pathname.indexOf(DOMAIN_PAGE_RELATIVE_URL.toLowerCase()) >= 0;
  //     const isCourse = pathname.indexOf(COURSE_PAGE_RELATIVE_URL.toLowerCase()) >= 0;

  //     if (!isDomain && !isCourse) return null;

  //     const params = u.searchParams;
  //     if (isDomain) {
  //       const idStr = params.get(DOMAIN_QUERY_PARAM);
  //       if (!idStr) return null;
  //       const id = parseInt(idStr, 10);
  //       if (!id) return null;
  //       return { type: 'domain', id };
  //     }

  //     if (isCourse) {
  //       const idStr = params.get(COURSE_QUERY_PARAM);
  //       if (!idStr) return null;
  //       const id = parseInt(idStr, 10);
  //       if (!id) return null;
  //       return { type: 'course', id };
  //     }

  //     return null;
  //   } catch {
  //     return null;
  //   }
  // }

  private normalizeUrlForKey(rawUrl: string): string {
    const base = this.props.context.pageContext.web.absoluteUrl;
    try {
      const u = new URL(rawUrl.trim(), base);
      let protocol = u.protocol.toLowerCase();
      let host = u.hostname.toLowerCase();
      let port = u.port;
      if ((protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443')) port = '';
      let pathname = u.pathname;
      if (pathname !== '/' && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
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
    if (typeof raw === 'string' && !isNaN(Date.parse(raw))) return new Date(raw);
    if (row.Modified && !isNaN(Date.parse(row.Modified))) return new Date(row.Modified);
    if (typeof row.Created === 'string' && !isNaN(Date.parse(row.Created))) return new Date(row.Created);
    return new Date(0);
  }

  private getTopTitles(rows: RawStatItem[], limit: number): TopTitle[] {
    const counts = new Map<string, TopTitle>();
    for (const r of rows) {
      const title = (r.Title || '').trim();
      if (!title) continue;
      const key = title.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { title, count: 1 });
      }
    }

    return Array.from(counts.values())
      .sort((a, b) => (b.count - a.count) || a.title.localeCompare(b.title))
      .slice(0, limit);
  }

  // ================== RENDER ==================

  public render(): React.ReactElement<IBPersonalZoneProps> {
    const { loading, error, items, recommendations, topTitles } = this.state;

    return (
      <section className={styles.bPersonalZone}>
        <TopNav context={this.props.context} />

        {/* HEADER — completely outside layout */}
        <div className={styles.pageHeader}>
          <div className={styles.courseTitle}>האזור האישי</div>
          <div className={styles.topSeperator}></div>
        </div>

        {/* LAYOUT */}
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
                <ul className={styles.list}>
                  {items.map((it, idx) => (
                    <li key={idx} className={styles.item}>
                      <a href={it.url} className={styles.link} target="_self" rel="noopener">
                        <span className={styles.title}>{it.title}</span>
                        <span className={styles.meta}>{this.formatDate(it.lastVisited)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {!loading && !error && (
                <>
                  <div className={styles.header4}>
                    דפים מומלצים
                  </div>

                  {recommendations.length === 0 ? (
                    <div className={styles.info}>אין המלצות כרגע.</div>
                  ) : (
                    <ul className={styles.list}>
                      {recommendations.map((it, idx) => (
                        <li key={`rec-${idx}`} className={styles.item}>
                          <a href={it.url} className={styles.link} target="_self" rel="noopener">
                            <span className={styles.title}>{it.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
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
                {topTitles.map((t, idx) => (
                  <div
                    key={`${t.title}-${idx}`}
                    className={styles.oneCourse}
                    style={{
                      backgroundImage: t.photoUrl ? `url('${t.photoUrl}')` : undefined
                    }}
                    onClick={() => {
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