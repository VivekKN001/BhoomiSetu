import { PlusCircle, Sparkles } from "lucide-react";
import TrussDivider from "./TrussDivider.jsx";
import SideRail from "./SideRail.jsx";
import Marquee from "./Marquee.jsx";
import palace from "../assets/mysuru/palace.jpg";
import garden from "../assets/mysuru/garden.jpg";
import nandi from "../assets/mysuru/nandi.jpg";
import circle from "../assets/mysuru/circle.jpg";
import chamundiTemple from "../assets/mysuru/chamundi-temple.jpg";
import church from "../assets/mysuru/church.jpg";

const MYSURU_IMAGES = [palace, garden, nandi, circle, chamundiTemple, church];

export default function HomeView({ setView, listingCount }) {
  return (
    <>
    <SideRail images={MYSURU_IMAGES} side="left" speed={38} />
    <SideRail images={[...MYSURU_IMAGES].reverse()} side="right" speed={30} />
    <div className="home">
      <Marquee images={MYSURU_IMAGES} speed={38} />
      <section className="hero">
        <p className="eyebrow">Mysuru · direct land deals</p>
        <h1>
          Buy and sell land <em>without</em> the middleman's margin.
        </h1>
        <p className="lede">
          BhoomiSetu connects Mysuru landowners straight to buyers. Every asking
          price is checked against what similar land nearby is actually going
          for — so nobody pays a hidden markup, and nobody underprices their
          own land.
        </p>
        <div className="ctaRow">
          <button className="btn btnPrimary" onClick={() => setView("sell")}>
            <PlusCircle size={18} /> List your land
          </button>
          <button className="btn btnGhost" onClick={() => setView("buy")}>
            <Sparkles size={18} /> Browse land
          </button>
        </div>
      </section>

      <div className="bridgeWrap">
        <TrussDivider />
        <div className="bridgeSides">
          <span>Seller uploads land</span>
          <span>Buyer discovers &amp; shortlists</span>
        </div>
        <TrussDivider flip />
      </div>

      <section className="stepsRow">
        <div className="stepCard">
          <span className="stepNum">01</span>
          <h3>Seller lists</h3>
          <p>Photos, location, size, advantages, and an asking price.</p>
        </div>
        <div className="stepCard">
          <span className="stepNum">02</span>
          <h3>We check the price</h3>
          <p>Compared against other listings in the same locality — flagged if it looks inflated or suspiciously low.</p>
        </div>
        <div className="stepCard">
          <span className="stepNum">03</span>
          <h3>Buyer swipes</h3>
          <p>Right if interested, left to pass. No contact info until there's a match.</p>
        </div>
        <div className="stepCard">
          <span className="stepNum">04</span>
          <h3>Direct contact</h3>
          <p>On a match, both sides can call — no agent, no commission.</p>
        </div>
      </section>

      <Marquee images={[...MYSURU_IMAGES].reverse()} reverse speed={30} />

      <footer className="foot">
        {listingCount} land parcels currently listed in Mysuru
      </footer>
    </div>
  </>);
}
