import * as React from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPFI, spfi } from "@pnp/sp";
import { Utilities } from "../Utilities/Utilities";
import { getSP } from "../../PNPConfig/pnpjsConfig";

import styles from './SlideShow.module.scss';

export interface IGalleryProps {
  context?: WebPartContext;
  SlideShowInteval: string;
}

export interface IGalleryItem {
  image: string;
  line1: string;
  line2: string;
  line3: string;
  freeText: string;
  link: string;
}

export interface IGalleryState {
  gallery: IGalleryItem[];
  currentIndex: number;
}

class Gallery extends React.Component<IGalleryProps, IGalleryState> {

  private interval: number | undefined;
  private _sp: SPFI;
  private _Utilities: Utilities;

  constructor(props: IGalleryProps) {
    super(props);

    this.state = {
      gallery: [],
      currentIndex: 0,
    };

    this.moveNext = this.moveNext.bind(this);
    this.movePrev = this.movePrev.bind(this);
    this.updateGalleryStyles = this.updateGalleryStyles.bind(this);
    this.clearTheInterval = this.clearTheInterval.bind(this);
    this.clearAndSetInterval = this.clearAndSetInterval.bind(this);
    this.startPage = this.startPage.bind(this);
    
    // Initialize hover tracking property
    this.isHovering = false;

    this._sp = getSP();
    this._Utilities = new Utilities();
  }

  private async _getItems() {
    const items: any[] = await this._Utilities._getAllPhotoGallerySlideshow();
    const galleryItems = items.map(item => ({
      image: item.FileRef,
      line1: item.Title1 || '[NULL]',
      line2: item.Title2 || '[NULL]',
      line3: item.Title3 || '[NULL]',
      freeText: item.Description1 || '',
      link: item.Link || '',
    }));

    this.setState({ gallery: galleryItems });

    // Start auto-slide
    this.startPage();
  }

  async componentDidMount(): Promise<void> {
    await this._getItems();
  }

  componentWillUnmount(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  startPage(): void {
    const _SlideShowInteval =  10000; // Number(this.props.SlideShowInteval) ||
    this.interval = window.setInterval(this.moveNext, _SlideShowInteval);
  }

  clearTheInterval(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  clearAndSetInterval(): void {
    this.clearTheInterval();
    this.startPage();
  }
  
  // Track if we're currently hovering or not
  private isHovering: boolean = false;

  moveNext(): void {
    const { currentIndex, gallery } = this.state;
    this.setState(
      {
        currentIndex: (currentIndex + 1) % gallery.length,
      },
      () => this.updateGalleryStyles()
    );
  }

  movePrev(): void {
    const { currentIndex, gallery } = this.state;
    this.setState(
      {
        currentIndex: (currentIndex - 1 + gallery.length) % gallery.length,
      },
      () => this.updateGalleryStyles()
    );
  }

  updateGalleryStyles(): void {
    const { currentIndex, gallery } = this.state;
    gallery.forEach((_, i) => {
      const element = document.getElementById(`img${i + 1}`);
      if (element) {
        element.style.backgroundColor = i === currentIndex ? "#5ce0e5" : "white";
      }
    });
  }

  render(): React.ReactElement {
    const { gallery, currentIndex } = this.state;

    if (gallery.length === 0) {
      return <div>טוען...</div>;
    }

    return (
      <>
        <div className={styles.slideShow}>
          <div 
            className={styles.inner}
            onMouseOver={() => {
              this.isHovering = true;
              this.clearTheInterval();
            }}
            onMouseOut={() => {
              this.isHovering = false;
              this.startPage();
            }}
          >
            <div className={styles.left}>
              <div className={styles.rightArrow} onClick={() => { 
                this.movePrev(); 
                // Only restart interval if not hovering
                if (!this.isHovering) {
                  this.clearAndSetInterval();
                }
              }}>&nbsp;</div>
              <div className={styles.images} onClick={() => gallery[currentIndex].link && window.open(gallery[currentIndex].link, '_blank')} >
                <div id="gal" className={styles.gallery}>
                  <div id="galleryImage1" className={styles.oneImage} style={{ backgroundImage: `url('${gallery[currentIndex].image}')` }}>
                  </div>
                </div>
              </div>
              <div className={styles.leftArrow} onClick={() => { 
                this.moveNext(); 
                // Only restart interval if not hovering
                if (!this.isHovering) {
                  this.clearAndSetInterval();
                }
              }}>&nbsp;</div>
            </div>

            {/* Text Section - No longer needs hover handlers */}
            <div
              id="freeText"
              className={styles.right}
              dangerouslySetInnerHTML={{ __html: gallery[currentIndex].freeText }}
            />
          </div>
        </div>

        {/* Gallery Navigation Dots */}
        <div className={styles.galleryButtons}>
          <div className={styles.left}>
            <div className={styles.inside}>
              {gallery.map((_, index) => (
                <div key={index} className={styles.oneButton}>
                  <div id={`img${index + 1}`} style={index === currentIndex ? { backgroundColor: "#5ce0e5" } : {}}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.bottomSeperator}></div>
      </>
    );
  }
}

export default Gallery;