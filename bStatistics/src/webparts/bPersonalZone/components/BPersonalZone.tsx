import * as React from 'react';
import styles from './BPersonalZone.module.scss';
import type { IBPersonalZoneProps } from './IBPersonalZoneProps';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

// ==== CONFIG – להתאים לפי הסביבה שלך ====

// רשימת הסטטיסטיקות
const LIST_TITLE = 'BezeqStatistics';

// רשימות מקור הדפים
const DOMAINS_LIST_TITLE = 'תחום';      // רשימת התחומים
const COURSES_LIST_TITLE = 'קורסים';    // רשימת הקורסים

// שם השדה של מילות המפתח בשתי הרשימות
const KEYWORDS_FIELD = 'KeyWords';

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
const MAX_ITEMS = 10;
const TOP_VISITS_FOR_RECS = 5;
const MAX_RECOMMENDED = 10;

// ==== TYPES ====

type RawStatItem = {
  Id: number;
  Title?: string;
  Link?: string;
  Created: string;
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

type SourceItem = PageRef & {
  title: string;
  keywordsRaw: string;
};

type State = {
  loading: boolean;
  error?: string;
  items: DedupedVisit[];
  recommendations: DedupedVisit[];
};

export default class BPersonalZone extends React.Component<IBPersonalZoneProps, State> {
  public state: State = { loading: true, items: [], recommendations: [] };

  public componentDidMount(): void {
    this.loadData().catch(err =>
      this.setState({ loading: false, error: (err as Error).message || 'Load error' })
    );
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
        lastVisited: new Date(r.Created),
        ref,
      });

      if (deduped.length >= MAX_ITEMS) break;
    }

    deduped.sort((a, b) => b.lastVisited.getTime() - a.lastVisited.getTime());

    const recommendations = await this.buildRecommendations(deduped);

    this.setState({ loading: false, items: deduped, recommendations });
  }


  // ================== RECOMMENDATIONS ==================

  private async buildRecommendations(recent: DedupedVisit[]): Promise<DedupedVisit[]> {
    const seed = recent.slice(0, TOP_VISITS_FOR_RECS);
    if (seed.length === 0) return [];

    const recentKeys = new Set(seed.map(s => this.normalizeUrlForKey(s.url)));

    // נעדיף לקחת את ה-ref מהסטטיסטיקות. רק אם אין – נפרש מה-URL
    const seedRefs: PageRef[] = [];
    for (const s of seed) {
      if (s.ref) {
        seedRefs.push(s.ref);
      } else {
        const ref = this.parsePageRefFromUrl(s.url);
        if (ref) seedRefs.push(ref);
      }
    }

    if (seedRefs.length === 0) return [];

    const domainIds = seedRefs.filter(r => r.type === 'domain').map(r => r.id);
    const courseIds = seedRefs.filter(r => r.type === 'course').map(r => r.id);

    // --- מילות מפתח עבור ה-seed משתי הרשימות ---
    const seedItems: SourceItem[] = [
      ...await this.fetchItemsByIds(DOMAINS_LIST_TITLE, 'domain', domainIds),
      ...await this.fetchItemsByIds(COURSES_LIST_TITLE, 'course', courseIds),
    ];

    const kwSet = new Set<string>();
    for (const item of seedItems) {
      const kws = this.parseKeywords(item.keywordsRaw || '');
      for (const k of kws) kwSet.add(k);
    }
    if (kwSet.size === 0) return [];

    // --- כל הפריטים האפשריים משתי הרשימות ---
    const allDomainItems = await this.fetchAllItems(DOMAINS_LIST_TITLE, 'domain');
    const allCourseItems = await this.fetchAllItems(COURSES_LIST_TITLE, 'course');
    const allItems: SourceItem[] = [...allDomainItems, ...allCourseItems];

    const seedKeySet = new Set<string>(
      seedRefs.map(r => `${r.type}:${r.id}`)
    );

    type Cand = { source: SourceItem; overlap: number; key: string };
    const candidates: Cand[] = [];

    for (const item of allItems) {
      const itemKey = `${item.type}:${item.id}`;

      // לא ממליצים על מה שכבר seed
      if (seedKeySet.has(itemKey)) continue;

      const url = this.buildPageUrl(item);
      const norm = this.normalizeUrlForKey(url);
      if (recentKeys.has(norm)) continue;

      const kws = this.parseKeywords(item.keywordsRaw || '');
      let overlap = 0;
      for (const kw of kws) if (kwSet.has(kw)) overlap++;

      if (overlap > 0) {
        candidates.push({
          source: item,
          overlap,
          key: norm,
        });
      }
    }

    candidates.sort((a, b) =>
      (b.overlap - a.overlap) ||
      (b.source.id - a.source.id)
    );

    const seenRec = new Set<string>();
    const recommended: DedupedVisit[] = [];

    for (const cand of candidates) {
      if (seenRec.has(cand.key)) continue;
      seenRec.add(cand.key);

      recommended.push({
        url: this.buildPageUrl(cand.source),
        title: cand.source.title,
        lastVisited: new Date(), // לא מוצג
      });

      if (recommended.length >= MAX_RECOMMENDED) break;
    }

    return recommended;
  }

  // ================== HELPERS – DATA FROM LISTS ==================

  private async fetchItemsByIds(
    listTitle: string,
    type: 'domain' | 'course',
    ids: number[]
  ): Promise<SourceItem[]> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;
    const results: SourceItem[] = [];
    const cleanIds = Array.from(new Set(ids.filter(id => !!id)));

    if (cleanIds.length === 0) return [];

    const groups = this.chunk(cleanIds, 15);

    for (const g of groups) {
      const orFilter = g.map(id => `Id eq ${id}`).join(' or ');
      const select = `$select=Id,Title,${KEYWORDS_FIELD}`;
      const filter = `$filter=(${orFilter})`;
      const url = encodeURI(
        `${webUrl}/_api/web/lists/getbytitle('${listTitle}')/items?${select}&${filter}&$top=500`
      );
      const resp = await context.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) continue;
      const json = await resp.json();
      const items = (json?.value || []) as any[];

      for (const it of items) {
        results.push({
          type,
          id: it.Id,
          title: (it.Title || '').trim() || '(ללא כותרת)',
          keywordsRaw: (it[KEYWORDS_FIELD] || '').toString(),
        });
      }
    }

    return results;
  }

  private async fetchAllItems(
    listTitle: string,
    type: 'domain' | 'course'
  ): Promise<SourceItem[]> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;
    const select = `$select=Id,Title,${KEYWORDS_FIELD}`;
    const orderby = `$orderby=Id asc`;
    const top = `$top=2000`;
    const url = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${listTitle}')/items?${select}&${orderby}&${top}`
    );
    const resp = await context.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) return [];
    const json = await resp.json();
    const rows = (json?.value || []) as any[];

    return rows.map(it => ({
      type,
      id: it.Id,
      title: (it.Title || '').trim() || '(ללא כותרת)',
      keywordsRaw: (it[KEYWORDS_FIELD] || '').toString(),
    }));
  }

  // ================== URL / KEYWORDS HELPERS ==================

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private parseKeywords(raw: string): string[] {
    return raw
      .split(/[;|,]/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  private buildPageUrl(ref: PageRef): string {
    const base = this.props.context.pageContext.web.absoluteUrl.replace(/\/$/, '');
    const isDomain = ref.type === 'domain';
    const pagePath = isDomain ? DOMAIN_PAGE_RELATIVE_URL : COURSE_PAGE_RELATIVE_URL;
    const paramName = isDomain ? DOMAIN_QUERY_PARAM : COURSE_QUERY_PARAM;
    const separator = pagePath.indexOf('?') >= 0 ? '&' : '?';
    return `${base}${pagePath}${separator}${paramName}=${encodeURIComponent(ref.id.toString())}`;
  }

  private parsePageRefFromUrl(rawUrl: string): PageRef | null {
    const base = this.props.context.pageContext.web.absoluteUrl;
    try {
      const u = new URL(rawUrl.trim(), base);
      const pathname = u.pathname.toLowerCase();

      const isDomain = pathname.indexOf(DOMAIN_PAGE_RELATIVE_URL.toLowerCase()) >= 0;
      const isCourse = pathname.indexOf(COURSE_PAGE_RELATIVE_URL.toLowerCase()) >= 0;

      if (!isDomain && !isCourse) return null;

      const params = u.searchParams;
      if (isDomain) {
        const idStr = params.get(DOMAIN_QUERY_PARAM);
        if (!idStr) return null;
        const id = parseInt(idStr, 10);
        if (!id) return null;
        return { type: 'domain', id };
      }

      if (isCourse) {
        const idStr = params.get(COURSE_QUERY_PARAM);
        if (!idStr) return null;
        const id = parseInt(idStr, 10);
        if (!id) return null;
        return { type: 'course', id };
      }

      return null;
    } catch {
      return null;
    }
  }

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

  // ================== RENDER ==================

  public render(): React.ReactElement<IBPersonalZoneProps> {
    const { loading, error, items, recommendations } = this.state;

    return (
      <section className={styles.bPersonalZone}>
        <div className={styles.header}>האזור האישי</div>

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
            <div className={styles.header2} style={{ marginTop: 14 }}>דפים מומלצים</div>
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
      </section>
    );
  }
}
