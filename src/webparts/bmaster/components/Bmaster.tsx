import * as React from 'react';
import styles from './Bmaster.module.scss';
import type { IBmasterProps } from './IBmasterProps';

import TopNav from './topNav/TopNav';
import BottomNav from './bottomNav/BottomNav';
import SlideShow from './SlideShow/SlideShow';
import Sections from './Sections/Sections';
import CoursesSection from './CoursesSection/CoursesSection';
import TopSeperator from './TopSeperator/TopSeperator';

import OneCourse from './OneCourse/OneCourse';
import CourseSign from './CourseSign/CourseSign';
import OneCourseThanks from './OneCourseThanks/OneCourseThanks';
import SearchResults from './SearchResults/SearchResults';
import ManagerPage from './ManagerPage/ManagerPage';
import VideoPage from './VideoPage/VideoPage';
import ContactUs from './ContactUs/ContactUs';



export default class Bmaster extends React.Component<IBmasterProps> {

  constructor(props: IBmasterProps) {
    super(props);
    this.injectBackgroundOverride();
  }

  private injectBackgroundOverride() {
    setTimeout(() => {
      const elements = document.querySelectorAll('.root-192.root-192.root-192.root-192.root-192');
      elements.forEach(el => {
        (el as HTMLElement).style.backgroundImage = 'none';
        (el as HTMLElement).style.backgroundColor = '#ffffff'; // Optional: change background color
      });
    }, 2000); // Delay to ensure SharePoint styles load first
  }

  public render(): React.ReactElement<IBmasterProps> {
    // Run the function again during render
    this.injectBackgroundOverride();

    const _PageType = this.props.PageType;

    return (
      <div className={styles.ContainerBmaster}>

        <TopNav></TopNav>
        <TopSeperator PageType={this.props.PageType}></TopSeperator>

        {_PageType === 'Main' &&
          <>
            <SlideShow SlideShowInteval={this.props.SlideShowInteval} ></SlideShow>
            <Sections></Sections>
          </>
        }

        {_PageType === 'Courses' &&
          <CoursesSection context={this.props.context} />
        }

        {_PageType === 'OneCourse' &&
          <OneCourse context={this.props.context}></OneCourse>
        }

        {_PageType === 'CourseSign' &&
          <CourseSign context={this.props.context}></CourseSign>
        }

        {_PageType === 'OneCourseThanks' &&
          <OneCourseThanks></OneCourseThanks>
        }

        {_PageType === 'SearchResults' &&
          <SearchResults ></SearchResults>
        }

        {_PageType === 'ManagerPage' &&
          <ManagerPage context={this.props.context}></ManagerPage>
        }

        {_PageType === 'VideoPage' &&
          <VideoPage context={this.props.context}></VideoPage>
        }

        {_PageType === 'ContactUs' &&
          <ContactUs context={this.props.context}></ContactUs>
        }
        {window.innerWidth <= 992 && <BottomNav />}

      </div>
    );
  }
}
