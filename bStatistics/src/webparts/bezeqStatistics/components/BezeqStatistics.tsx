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
};

type PageAgg = { page: string; total: number };
type UserAgg = { userKey: string; total: number };

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

  // Drilldown לפי משתמש
  selectedUser?: string | null;
  selectedUserRows: Array<{ page: string; total: number }>;
}


const LIST_TITLE = 'BezeqStatistics';
const USER_TEXT_FIELD = 'UserNameText'; 

export default class BezeqStatistics extends React.Component<IBezeqStatisticsProps, State> {

  constructor(props: IBezeqStatisticsProps) {
    super(props);
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    this.state = {
      report: 'byPage',
      dateFrom: weekAgo.toISOString().slice(0,10),
      dateTo: today.toISOString().slice(0,10),
      loading: false,
      rawItems: [],
      pageAgg: [],
      userAgg: [],
      selectedPage: null,
      selectedPageRows: [],
      selectedUser: null,
      selectedUserRows: []
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
      const select = `$select=Id,Title,Created,${USER_TEXT_FIELD},Author/Title`;
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
        rawItems, pageAgg, userAgg, loading: false,
        selectedPage: null, selectedPageRows: [],
        selectedUser: null, selectedUserRows: []
      });
        } catch (e: any) {
      this.setState({ loading: false, error: e?.message || 'שגיאה בשליפת הנתונים' });
    }
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

  private onClickUser = (userKey: string) => {
    const rows = this.buildDetailsForUser(userKey);
    this.setState({
      selectedUser: userKey,
      selectedUserRows: rows,
      selectedPage: null,
      selectedPageRows: []
    });
  };
  
  
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
    const map = new Map<string, number>();
    for (const it of items) {
      const page = it.Title || 'ללא שם';
      map.set(page, (map.get(page) || 0) + 1); // כל רשומה = כניסה אחת
    }
    return Array.from(map.entries())
      .map(([page, total]) => ({ page, total }))
      .sort((a, b) => b.total - a.total || a.page.localeCompare(b.page, 'he'));
  }

  private aggregateByUser(items: RawItem[]): UserAgg[] {
    const map = new Map<string, number>();
    for (const it of items) {
      const userKey = this.getUserKey(it);
      map.set(userKey, (map.get(userKey) || 0) + 1); // כל רשומה = כניסה אחת
    }
    return Array.from(map.entries())
      .map(([userKey, total]) => ({ userKey, total }))
      .sort((a, b) => b.total - a.total || a.userKey.localeCompare(b.userKey, 'he'));
  }

  private buildDetailsForPage(page: string): Array<{ user: string; date: string }> {
    return this.state.rawItems
      .filter(it => (it.Title || 'ללא שם') === page)
      .map(it => ({ user: this.getUserKey(it), date: it.Created }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // -------- UI handlers --------
  private onChangeReport = (e: React.ChangeEvent<HTMLSelectElement>) =>
    this.setState({
      report: (e.target.value as ReportType) || 'byPage',
      selectedPage: null,
      selectedPageRows: [],
      selectedUser: null,
      selectedUserRows: []
    });

  private onChangeFrom = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({ dateFrom: e.target.value });

  private onChangeTo = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({ dateTo: e.target.value });

 
private onRefresh = () =>
  this.setState({
    selectedPage: null,
    selectedPageRows: [],
    selectedUser: null,
    selectedUserRows: []
  }, () => this.loadData());

  private onClickPage = (page: string) =>
    this.setState({ selectedPage: page, selectedPageRows: this.buildDetailsForPage(page) });

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
          <input className={styles.date} type="date" value={dateFrom || ''} onChange={this.onChangeFrom} disabled={loading}/>
        </label>
        <label>עד תאריך:&nbsp;
          <input className={styles.date} type="date" value={dateTo || ''} onChange={this.onChangeTo} disabled={loading}/>
        </label>

        <button onClick={this.onRefresh} disabled={loading}
          style={{padding:'6px 10px', border:'1px solid #d0d7de', borderRadius:6, background:'#f6f8fa', cursor:'pointer'}}>
          רענון
        </button>
       
      </div>
    );
  }

  private renderByPage() {
    const { pageAgg, loading } = this.state;
    return (
      <table className={styles.table} aria-label="כניסות לפי דף">
        <thead>
          <tr>
            <th>דף</th>
            <th style={{width:120}}>סה"כ כניסות</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={2}>טוען נתונים…</td></tr>
          ) : pageAgg.length === 0 ? (
            <tr><td colSpan={2}>לא נמצאו נתונים בטווח הנבחר</td></tr>
          ) : pageAgg.map(r => (
            <tr key={r.page}>
              <td><span className={styles.linkLike} onClick={() => this.onClickPage(r.page)}>{r.page}</span></td>
              <td><span className={styles.badge}>{r.total}</span></td>
            </tr>
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
            <th style={{width:120}}>סה"כ כניסות</th>
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
    const { selectedPage, selectedPageRows, selectedUser, selectedUserRows } = this.state;
  
    if (!selectedPage && !selectedUser) return null;
  
    // כפתור סגירה משותף
    const closeBtn = (
      <button
        onClick={() => this.setState({
          selectedPage: null, selectedPageRows: [],
          selectedUser: null, selectedUserRows: []
        })}
        style={{padding:'4px 8px', border:'1px solid #d0d7de', borderRadius:6, background:'#fff', cursor:'pointer'}}
      >
        סגור
      </button>
    );
  
    if (selectedPage) {
      return (
        <div className={styles.panel} role="region" aria-label="פירוט לפי דף">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <h3>פירוט כניסות לדף: {selectedPage}</h3>
            {closeBtn}
          </div>
          <table className={styles.table}>
            <thead>
              <tr><th>משתמש</th><th>תאריך</th></tr>
            </thead>
            <tbody>
              {selectedPageRows.length === 0 ? (
                <tr><td colSpan={2}>אין נתונים לדף זה בטווח הנבחר</td></tr>
              ) : selectedPageRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.user}</td>
                  <td>{new Date(r.date).toLocaleString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  
    // selectedUser
    return (
      <div className={styles.panel} role="region" aria-label="פירוט לפי משתמש">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <h3>כניסות של משתמש: {selectedUser}</h3>
          {closeBtn}
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>דף</th>
              <th style={{width:120}}>סה"כ כניסות</th>
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
        {error && <div style={{color:'#d00', marginBottom:12}}>שגיאה: {error}</div>}
        <div className={styles.split}>
          <div>{report === 'byPage' ? this.renderByPage() : this.renderByUser()}</div>
          <div>{this.renderDetailsPanel()}</div>
        </div>
      </section>
    );
  }
}
