import Slideshow from '../components/Slideshow';
import ReviewsStrip from '../components/ReviewsStrip';

// Homepage par courses show nahi hotay: sirf slideshow + reviews
export default function Home() {
  return (
    <>
      <Slideshow />
      <ReviewsStrip />
    </>
  );
}
