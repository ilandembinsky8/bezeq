import * as React from 'react';
import styles from './BPersonalZone.module.scss';
import type { IBPersonalZoneProps } from './IBPersonalZoneProps';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

// ---- Props ----
const LIST_TITLE = 'BezeqStatistics';
const PAGES_LIST_TITLE = 'BezeqPages';
const MAX_ITEMS = 10;
const TOP_VISITS_FOR_RECS = 5;
const MAX_RECOMMENDED = 10;
const KEYWORDS_FIELD = 'KeyWords';

type RawStatItem = {
  Id: number;
  Title?: string;
  Link?: string;
  Created: string;
  Author?: { Id: number };
};

type RawPageItem = {
  Id: number;
  Title?: string;
  Link?: string;           
  [key: string]: any;     
};

type DedupedVisit = {
  title: string;
  url: string;
  lastVisited: Date;
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

  private async loadData(): Promise<void> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;

    const meResp = await context.spHttpClient.get(
      `${webUrl}/_api/web/currentuser`,
      SPHttpClient.configurations.v1
    );
    if (!meResp.ok) throw new Error(`Failed to get current user (${meResp.status})`);
    const me = await meResp.json();
    const myId: number = me?.Id;
    if (!myId) throw new Error('Cannot resolve current user id');

    const select = `$select=Id,Title,Link,Created,Author/Id`;
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

    const seen = new Set<string>();
    const deduped: DedupedVisit[] = [];

    for (const r of rows) {
      const url = (r.Link || '').trim();
      if (!url) continue;

      const key = this.normalizeUrlForKey(url);
      if (seen.has(key)) continue;

      seen.add(key);
      deduped.push({
        url,
        title: r.Title || url,
        lastVisited: new Date(r.Created),
      });

      if (deduped.length >= MAX_ITEMS) break;
    }

    deduped.sort((a, b) => b.lastVisited.getTime() - a.lastVisited.getTime());

    const recommendations = await this.buildRecommendations(deduped);

    this.setState({ loading: false, items: deduped, recommendations });
  }

  private async buildRecommendations(recent: DedupedVisit[]): Promise<DedupedVisit[]> {
    // seed = חמשת הדפים הראשונים שהוצגו למשתמש
    const seed = recent.slice(0, TOP_VISITS_FOR_RECS);
    if (seed.length === 0) return [];

    const recentKeys = new Set(seed.map(s => this.normalizeUrlForKey(s.url)));
    const seedTitles = new Set(seed.map(s => (s.title || '').trim()).filter(Boolean));

    // מילות מפתח של seed מתוך BezeqPages
    const seedPages = await this.fetchPagesByTitles(Array.from(seedTitles));
    const kwSet = new Set<string>();
    for (const p of seedPages) {
      const kws = this.parseKeywords(p[KEYWORDS_FIELD] || '');
      for (const k of kws) kwSet.add(k);
    }
    if (kwSet.size === 0) return [];

    // כל הדפים עם לינק+מילות מפתח מ-BezeqPages
    const allPages = await this.fetchAllPages();

    debugger;
    type Cand = { id: number; title: string; link: string; overlap: number; key: string };
    const candidates: Cand[] = [];

    for (const p of allPages) {
      const title = (p.Title || '').trim();
      const link = (p.Link || '').trim();
      if (!title) continue;

      // לא ממליצים על מה שכבר הופיע ב"דפים אחרונים" / seed
      if (seedTitles.has(title)) continue;

      const k = this.normalizeUrlForKey(link);
      if (recentKeys.has(k)) continue;

      const kws = this.parseKeywords(p[KEYWORDS_FIELD] || '');
      let overlap = 0;
      for (const kw of kws) if (kwSet.has(kw)) overlap++;

      if (overlap > 0) {
        candidates.push({ id: p.Id, title, link, overlap, key: k });
      }
    }

    // מיון: התאמה גבוהה קודם; בשוויון—Id גבוה קודם (תחליף “סביר” לחדשותיות)
    candidates.sort((a, b) => (b.overlap - a.overlap) || (b.id - a.id));

    // דילול לפי URL מנורמל והגבלה ל- MAX_RECOMMENDED
    const seenRec = new Set<string>();
    const recommended: DedupedVisit[] = [];
    for (const c of candidates) {
      if (seenRec.has(c.key)) continue;
      seenRec.add(c.key);

      recommended.push({
        url: c.link,
        title: c.title,
        // אין לנו "תאריך ביקור" אמיתי פה—נכניס now לשדה טכני בלבד (לא מוצג ב־UI למטה)
        lastVisited: new Date()
      });

      if (recommended.length >= MAX_RECOMMENDED) break;
    }

    return recommended;
  }


  // ---- עזר לשאילתות BezeqPages ----

  /** שולף מ-BezeqPages לפי רשימת כותרות */
  private async fetchPagesByTitles(titles: string[]): Promise<RawPageItem[]> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;
    const results: RawPageItem[] = [];

    const groups = this.chunk(
      titles.filter(Boolean).map(t => t.trim()),
      15
    );

    debugger;
    for (const g of groups) {
      const orFilter = g.map(t => `Title eq '${this.escODataLiteral(t)}'`).join(' or ');
      const select = `$select=Id,Title,Link,${KEYWORDS_FIELD}`;
      const filter = `$filter=(${orFilter})`;
      const url = encodeURI(
        `${webUrl}/_api/web/lists/getbytitle('${PAGES_LIST_TITLE}')/items?${select}&${filter}&$top=500`
      );
      const resp = await context.spHttpClient.get(url, SPHttpClient.configurations.v1);
      if (!resp.ok) continue;
      const json = await resp.json();
      results.push(...(json?.value || []));
    }
    return results;
  }

  private async fetchAllPages(): Promise<RawPageItem[]> {
    const { context } = this.props;
    const webUrl = context.pageContext.web.absoluteUrl;
    const select = `$select=Id,Title,Link,${KEYWORDS_FIELD}`;
    const orderby = `$orderby=Id asc`;
    const top = `$top=2000`;
    const url = encodeURI(
      `${webUrl}/_api/web/lists/getbytitle('${PAGES_LIST_TITLE}')/items?${select}&${orderby}&${top}`
    );
    const resp = await context.spHttpClient.get(url, SPHttpClient.configurations.v1);
    if (!resp.ok) return [];
    const json = await resp.json();
    return json?.value || [];
  }

  // ---- Utilities ----

  private escODataLiteral(v: string): string {
    return v.replace(/'/g, "''");
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private parseKeywords(raw: string): string[] {
    return raw
      .split(/[;|,]/) // תומך ; וגם , אם יופיע
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
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

        {/* --- דפים מומלצים --- */}
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
                      {/* בלי תאריך למומלצים */}
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
