import * as React from 'react';
import styles from './BezeqStatistics.module.scss';
import type { IBezeqStatisticsProps } from './IBezeqStatisticsProps';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

type ReportType = 'byPage' | 'byUser';

type RawItem = {
  Id: number;
  Title: string;
  Created: string;
  Author?: { Title?: string; Email?: string };
  UserNameText?: string;
  PageType?: string;
};

type PageAgg = { page: string; total: number; pageType?: string; uniqueUsers: number };
type UserAgg = { userKey: string; total: number };

type HoverSeries = 'total' | 'unique';

interface HoveredPoint {
  series: HoverSeries;
  date: string;
  value: number;
  x: number;
  y: number;
}

interface State {
  report: ReportType;
  dateFrom?: string;
  dateTo?: string;
  loading: boolean;
  error?: string | null;

  rawItems: RawItem[];
  pageAgg: PageAgg[];
  userAgg: UserAgg[];

  // Drilldown לפי דף
  selectedPage?: string | null;
  selectedPageRows: Array<{ user: string; date: string }>;
  selectedPageDailyStats: Array<{ date: string; total: number; uniqueUsers: number }>;

  // Drilldown לפי משתמש
  selectedUser?: string | null;
  selectedUserRows: Array<{ page: string; total: number }>;

  // Tooltip גרפים
  hoveredPoint?: HoveredPoint;
}

const LIST_TITLE = 'BezeqStatistics';
const USER_TEXT_FIELD = 'UserNameText';

export default class BezeqStatistics extends React.Component<IBezeqStatisticsProps, State> {

  constructor(props: IBezeqStatisticsProps) {
    super(props);

    // ברירת מחדל – שבוע אחרון
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    this.state = {
      report: 'byPage',
      dateFrom: weekAgo.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
      loading: false,
      rawItems: [],
      pageAgg: [],
      userAgg: [],
      selectedPage: null,
      selectedPageRows: [],
      selectedPageDailyStats: [],
      selectedUser: null,
      selectedUserRows: [],
      hoveredPoint: undefined
    };
  }

  public componentDidMount(): void {
    this.loadData();
  }

  // -------- Data loading --------
  private async loadData(): Promise<void> {
    try {
      this.setState({ loading: true, error: null });

      const webUrl = this.props.context.pageContext.web.absoluteUrl;
      const select = `$select=Id,Title,Created,PageType,${USER_TEXT_FIELD},Author/Title`;
      const expand = `$expand=Author`;
      const orderby = `$orderby=Id desc`;

      const { dateFrom, dateTo } = this.state;
      let filter = '';
      if (dateFrom && dateTo) {
        const fromIso = new Date(dateFrom + 'T00:00:00Z').toISOString();
        const toIso = new Date(dateTo + 'T23:59:59Z').toISOString();
        filter = `$filter=Created ge datetime'${fromIso}' and Created le datetime'${toIso}'`;
      } else if (dateFrom) {
        const fromIso = new Date(dateFrom + 'T00:00:00Z').toISOString();
        filter = `$filter=Created ge datetime'${fromIso}'`;
      } else if (dateTo) {
        const toIso = new Date(dateTo + 'T23:59:59Z').toISOString();
        filter = `$filter=Created le datetime'${toIso}'`;
      }

      const baseUrl = `${webUrl}/_api/web/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')/items?${select}&${expand}&${orderby}${filter ? '&' + filter : ''}&$top=5000`;
      const rawItems = await this.fetchAll<RawItem>(baseUrl);

      const pageAgg = this.aggregateByPage(rawItems);
      const userAgg = this.aggregateByUser(rawItems);

      this.setState({
        rawItems,
        pageAgg,
        userAgg,
        loading: false,
        selectedPage: null,
        selectedPageRows: [],
        selectedPageDailyStats: [],
        selectedUser: null,
        selectedUserRows: [],
        hoveredPoint: undefined
      });
    } catch (e: any) {
      this.setState({ loading: false, error: e?.message || 'שגיאה בשליפת הנתונים' });
    }
  }

  private async fetchAll<T = any>(url: string): Promise<T[]> {
    const all: T[] = [];
    let next: string | null = url;

    while (next) {
      const resp: SPHttpClientResponse = await this.props.context.spHttpClient.get(next, SPHttpClient.configurations.v1);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      all.push(...(json.value || []));
      next = json['@odata.nextLink'] || null;
    }
    return all;
  }

  // -------- Helpers --------
  private getUserKey(it: RawItem): string {
    const t = (it as any)[USER_TEXT_FIELD];
    if (t && typeof t === 'string' && t.trim()) return t.trim();
    if (it.Author?.Email) return String(it.Author.Email).toLowerCase();
    return it.Author?.Title || 'לא ידוע';
  }

  private aggregateByPage(items: RawItem[]): PageAgg[] {
    const map = new Map<string, { total: number; pageType?: string; users: Set<string> }>();

    for (const it of items) {
      const page = it.Title || 'ללא שם';
      const pt = (it as any).PageType as string | undefined;
      const userKey = this.getUserKey(it);

      if (!map.has(page)) {
        map.set(page, { total: 0, pageType: pt, users: new Set<string>() });
      }

      const entry = map.get(page)!;
      entry.total += 1;
      entry.users.add(userKey);

      if (!entry.pageType && pt) {
        entry.pageType = pt;
      }
    }

    return Array.from(map.entries())
      .map(([page, info]) => ({
        page,
        total: info.total,
        pageType: info.pageType,
        uniqueUsers: info.users.size
      }))
      .sort((a, b) => b.total - a.total || a.page.localeCompare(b.page, 'he'));
  }

  private aggregateByUser(items: RawItem[]): UserAgg[] {
    const map = new Map<string, number>();
    for (const it of items) {
      const userKey = this.getUserKey(it);
      map.set(userKey, (map.get(userKey) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([userKey, total]) => ({ userKey, total }))
      .sort((a, b) => b.total - a.total || a.userKey.localeCompare(b.userKey, 'he'));
  }

  /** פרטי כניסות לדף – על כל הטווח שנבחר */
  private buildDetailsForPage(page: string): Array<{ user: string; date: string }> {
    return this.state.rawItems
      .filter(it => (it.Title || 'ללא שם') === page)
      .map(it => ({ user: this.getUserKey(it), date: it.Created }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /** סטטיסטיקה יומית לדף – על כל הטווח שנשלף (כלומר הטווח שבחר המשתמש) */
  private buildDailyStatsForPage(page: string): Array<{ date: string; total: number; uniqueUsers: number }> {
    const { rawItems } = this.state;

    const map = new Map<string, { total: number; users: Set<string> }>();

    for (const it of rawItems) {
      const pageTitle = it.Title || 'ללא שם';
      if (pageTitle !== page) continue;

      const created = new Date(it.Created);

      const year = created.getFullYear();
      const monthNum = created.getMonth() + 1;
      const dayNum = created.getDate();
      const month = (monthNum < 10 ? '0' : '') + monthNum;
      const day = (dayNum < 10 ? '0' : '') + dayNum;
      const dateKey = `${year}-${month}-${day}`;

      if (!map.has(dateKey)) {
        map.set(dateKey, { total: 0, users: new Set<string>() });
      }

      const entry = map.get(dateKey)!;
      entry.total += 1;
      entry.users.add(this.getUserKey(it));
    }

    const arr: Array<{ date: string; total: number; uniqueUsers: number }> = [];
    map.forEach((value, date) => {
      arr.push({
        date,
        total: value.total,
        uniqueUsers: value.users.size
      });
    });

    // סדר כרונולוגי
    arr.sort((a, b) => a.date.localeCompare(b.date));

    return arr;
  }

  private buildDetailsForUser(userKey: string): Array<{ page: string; total: number }> {
    const map = new Map<string, number>();
    for (const it of this.state.rawItems) {
      if (this.getUserKey(it) === userKey) {
        const page = it.Title || 'ללא שם';
        map.set(page, (map.get(page) || 0) + 1);
      }
    }
    const arr: Array<{ page: string; total: number }> = [];
    map.forEach((total: number, page: string) => arr.push({ page, total }));
    arr.sort((a, b) => b.total - a.total || a.page.localeCompare(b.page, 'he'));
    return arr;
  }

  // -------- UI handlers --------
  private onChangeReport = (e: React.ChangeEvent<HTMLSelectElement>) =>
    this.setState({
      report: (e.target.value as ReportType) || 'byPage',
      selectedPage: null,
      selectedPageRows: [],
      selectedPageDailyStats: [],
      selectedUser: null,
      selectedUserRows: [],
      hoveredPoint: undefined
    });

  private onChangeFrom = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({ dateFrom: e.target.value });

  private onChangeTo = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({ dateTo: e.target.value });

  private onRefresh = () =>
    this.setState(
      {
        selectedPage: null,
        selectedPageRows: [],
        selectedPageDailyStats: [],
        selectedUser: null,
        selectedUserRows: [],
        hoveredPoint: undefined
      },
      () => this.loadData()
    );

  private onClickPage = (page: string) =>
    this.setState(prev => {
      if (prev.selectedPage === page) {
        return {
          ...prev,
          selectedPage: null,
          selectedPageRows: [],
          selectedPageDailyStats: [],
          hoveredPoint: undefined
        };
      }

      return {
        ...prev,
        selectedPage: page,
        selectedPageRows: this.buildDetailsForPage(page),
        selectedPageDailyStats: this.buildDailyStatsForPage(page),
        selectedUser: null,
        selectedUserRows: [],
        hoveredPoint: undefined
      };
    });

  private onClickUser = (userKey: string) => {
    const rows = this.buildDetailsForUser(userKey);
    this.setState({
      selectedUser: userKey,
      selectedUserRows: rows,
      selectedPage: null,
      selectedPageRows: [],
      selectedPageDailyStats: [],
      hoveredPoint: undefined
    });
  };

  // -------- Charts (line charts + tooltip) --------
  private renderPageCharts(stats: Array<{ date: string; total: number; uniqueUsers: number }>) {
    const { hoveredPoint } = this.state;

    const formatLabel = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

    if (!stats || stats.length === 0) {
      return (
        <div className={styles.chartsContainer}>
          <div className={styles.chartBlock}>
            <div className={styles.chartTitle}>סה"כ כניסות בטווח הנבחר</div>
            <div className={styles.chartNoData}>אין נתונים לגרף בטווח הנבחר</div>
          </div>
          <div className={styles.chartBlock}>
            <div className={styles.chartTitle}>צופים ייחודיים בטווח הנבחר</div>
            <div className={styles.chartNoData}>אין נתונים לגרף בטווח הנבחר</div>
          </div>
        </div>
      );
    }

    const maxTotal = Math.max(...stats.map(s => s.total)) || 1;
    const maxUnique = Math.max(...stats.map(s => s.uniqueUsers)) || 1;
    const n = stats.length;

    const width = 260;
    const height = 120;
    const padding = 10;

    const buildLinePoints = (values: number[], maxValue: number): string => {
      if (n === 1) {
        const x = width / 2;
        const y = height - padding - (values[0] / maxValue) * (height - 2 * padding);
        return `${x},${y}`;
      }

      return values
        .map((val, index) => {
          const x = padding + (index / (n - 1)) * (width - 2 * padding);
          const y = height - padding - (val / maxValue) * (height - 2 * padding);
          return `${x},${y}`;
        })
        .join(' ');
    };

    const totalValues = stats.map(s => s.total);
    const uniqueValues = stats.map(s => s.uniqueUsers);

    const totalPoints = buildLinePoints(totalValues, maxTotal);
    const uniquePoints = buildLinePoints(uniqueValues, maxUnique);

    const clearHover = () => this.setState({ hoveredPoint: undefined });

    return (
      <div className={styles.chartsContainer}>
        {/* גרף סה"כ כניסות */}
        <div className={styles.chartBlock}>
          <div className={styles.chartTitle}>סה"כ כניסות בטווח הנבחר</div>
          <div className={styles.chartBody}>
            <div
              className={styles.chartSvgWrapper}
              onMouseLeave={clearHover}
            >
              <svg
                className={styles.chartSvg}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
              >
                {/* קו בסיס */}
                <line
                  x1={padding}
                  y1={height - padding}
                  x2={width - padding}
                  y2={height - padding}
                  className={styles.chartAxis}
                />
                {/* קו הגרף */}
                <polyline
                  className={styles.chartLineTotal}
                  fill="none"
                  points={totalPoints}
                />
                {/* נקודות */}
                {stats.map((s, index) => {
                  const val = s.total;
                  const x = n === 1
                    ? width / 2
                    : padding + (index / (n - 1)) * (width - 2 * padding);
                  const y = height - padding - (val / maxTotal) * (height - 2 * padding);
                  return (
                    <circle
                      key={s.date}
                      className={styles.chartDotTotal}
                      cx={x}
                      cy={y}
                      r={2.5}
                      onMouseEnter={() =>
                        this.setState({
                          hoveredPoint: {
                            series: 'total',
                            date: s.date,
                            value: val,
                            x,
                            y
                          }
                        })
                      }
                    />
                  );
                })}
              </svg>

              {/* Tooltip מעל הנקודה */}
              {hoveredPoint && hoveredPoint.series === 'total' && (
                <div
                  className={styles.chartTooltip}
                  style={{
                    left: `${(hoveredPoint.x / width) * 100}%`,
                    top: `${(hoveredPoint.y / height) * 100}%`
                  }}
                >
                  <div className={styles.chartTooltipValue}>{hoveredPoint.value}</div>
                  <div className={styles.chartTooltipDate}>
                    {new Date(hoveredPoint.date).toLocaleDateString('he-IL')}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.chartLabelsRow}>
              {stats.map(s => (
                <span key={`total-label-${s.date}`} className={styles.chartLabel}>
                  {formatLabel(s.date)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* גרף צופים ייחודיים */}
        <div className={styles.chartBlock}>
          <div className={styles.chartTitle}>צופים ייחודיים בטווח הנבחר</div>
          <div className={styles.chartBody}>
            <div
              className={styles.chartSvgWrapper}
              onMouseLeave={clearHover}
            >
              <svg
                className={styles.chartSvg}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
              >
                {/* קו בסיס */}
                <line
                  x1={padding}
                  y1={height - padding}
                  x2={width - padding}
                  y2={height - padding}
                  className={styles.chartAxis}
                />
                {/* קו הגרף */}
                <polyline
                  className={styles.chartLineUnique}
                  fill="none"
                  points={uniquePoints}
                />
                {/* נקודות */}
                {stats.map((s, index) => {
                  const val = s.uniqueUsers;
                  const x = n === 1
                    ? width / 2
                    : padding + (index / (n - 1)) * (width - 2 * padding);
                  const y = height - padding - (val / maxUnique) * (height - 2 * padding);
                  return (
                    <circle
                      key={s.date}
                      className={styles.chartDotUnique}
                      cx={x}
                      cy={y}
                      r={2.5}
                      onMouseEnter={() =>
                        this.setState({
                          hoveredPoint: {
                            series: 'unique',
                            date: s.date,
                            value: val,
                            x,
                            y
                          }
                        })
                      }
                    />
                  );
                })}
              </svg>

              {/* Tooltip מעל הנקודה */}
              {hoveredPoint && hoveredPoint.series === 'unique' && (
                <div
                  className={styles.chartTooltip}
                  style={{
                    left: `${(hoveredPoint.x / width) * 100}%`,
                    top: `${(hoveredPoint.y / height) * 100}%`
                  }}
                >
                  <div className={styles.chartTooltipValue}>{hoveredPoint.value}</div>
                  <div className={styles.chartTooltipDate}>
                    {new Date(hoveredPoint.date).toLocaleDateString('he-IL')}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.chartLabelsRow}>
              {stats.map(s => (
                <span key={`unique-label-${s.date}`} className={styles.chartLabel}>
                  {formatLabel(s.date)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------- Renders --------
  private renderToolbar() {
    const { report, dateFrom, dateTo, loading } = this.state;
    return (
      <div className={styles.toolbar}>
        <select className={styles.select} value={report} onChange={this.onChangeReport} disabled={loading}>
          <option value="byPage">דו"ח כניסות לפי דף</option>
          <option value="byUser">דו"ח כניסות לפי משתמש</option>
        </select>

        <label>מתאריך:&nbsp;
          <input className={styles.date} type="date" value={dateFrom || ''} onChange={this.onChangeFrom} disabled={loading} />
        </label>
        <label>עד תאריך:&nbsp;
          <input className={styles.date} type="date" value={dateTo || ''} onChange={this.onChangeTo} disabled={loading} />
        </label>

        <button
          className={styles.button}
          onClick={this.onRefresh}
          disabled={loading}
        >
          רענון
        </button>
      </div>
    );
  }

  private renderByPage() {
    const { pageAgg, loading, selectedPage, selectedPageRows, selectedPageDailyStats } = this.state;

    return (
      <table className={styles.table} aria-label="כניסות לפי דף">
        <thead>
          <tr>
            <th>דף</th>
            <th style={{ width: 100 }}>סוג</th>
            <th style={{ width: 120 }}>סה"כ כניסות</th>
            <th style={{ width: 140 }}>משתמשים ייחודיים</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4}>טוען נתונים…</td></tr>
          ) : pageAgg.length === 0 ? (
            <tr><td colSpan={4}>לא נמצאו נתונים בטווח הנבחר</td></tr>
          ) : pageAgg.map(r => (
            <React.Fragment key={r.page}>
              <tr
                className={styles.clickableRow}
                onClick={() => this.onClickPage(r.page)}
              >
                <td>{r.page}</td>
                <td>{r.pageType || '-'}</td>
                <td><span className={styles.badge}>{r.total}</span></td>
                <td><span className={styles.badge}>{r.uniqueUsers}</span></td>
              </tr>

              {selectedPage === r.page && (
                <tr>
                  <td colSpan={4}>
                    <div
                      className={styles.panel}
                      role="region"
                      aria-label={`פירוט כניסות לדף ${r.page}`}
                    >
                      {/* גרפים – על הטווח שנבחר */}
                      {this.renderPageCharts(selectedPageDailyStats)}

                      {/* טבלת פירוט משתמשים */}
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>משתמש</th>
                            <th style={{ width: 180 }}>תאריך</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPageRows.length === 0 ? (
                            <tr><td colSpan={2}>אין נתונים לדף זה בטווח הנבחר</td></tr>
                          ) : selectedPageRows.map((row, i) => (
                            <tr key={i}>
                              <td>{row.user}</td>
                              <td>{new Date(row.date).toLocaleString('he-IL')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    );
  }

  private renderByUser() {
    const { userAgg, loading } = this.state;
    return (
      <table className={styles.table} aria-label="כניסות לפי משתמש">
        <thead>
          <tr>
            <th>משתמש</th>
            <th style={{ width: 120 }}>סה"כ כניסות</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={2}>טוען נתונים…</td></tr>
          ) : userAgg.length === 0 ? (
            <tr><td colSpan={2}>לא נמצאו נתונים בטווח הנבחר</td></tr>
          ) : userAgg.map(u => (
            <tr key={u.userKey}>
              <td>
                <span
                  className={styles.linkLike}
                  title="לחץ להצגת פירוט לפי דפים"
                  onClick={() => this.onClickUser(u.userKey)}
                >
                  {u.userKey}
                </span>
              </td>
              <td><span className={styles.badge}>{u.total}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  private renderDetailsPanel() {
    const { selectedUser, selectedUserRows } = this.state;

    if (!selectedUser) return null;

    const closeBtn = (
      <button
        className={styles.button}
        onClick={() => this.setState({
          selectedUser: null,
          selectedUserRows: []
        })}
      >
        סגור
      </button>
    );

    return (
      <div className={styles.panel} role="region" aria-label="פירוט לפי משתמש">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3>כניסות של משתמש: {selectedUser}</h3>
          {closeBtn}
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>דף</th>
              <th style={{ width: 120 }}>סה"כ כניסות</th>
            </tr>
          </thead>
          <tbody>
            {selectedUserRows.length === 0 ? (
              <tr><td colSpan={2}>אין כניסות למשתמש זה בטווח הנבחר</td></tr>
            ) : selectedUserRows.map(r => (
              <tr key={r.page}>
                <td>{r.page}</td>
                <td><span className={styles.badge}>{r.total}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  public render(): React.ReactElement<IBezeqStatisticsProps> {
    const { report, error } = this.state;
    return (
      <section className={styles.bezeqStatistics}>
        <div className={styles.header}>דו"חות שימוש</div>
        {this.renderToolbar()}
        {error && <div style={{ color: '#d00', marginBottom: 12 }}>שגיאה: {error}</div>}
        <div className={styles.split}>
          <div>{report === 'byPage' ? this.renderByPage() : this.renderByUser()}</div>
          <div>{this.renderDetailsPanel()}</div>
        </div>
      </section>
    );
  }
}
