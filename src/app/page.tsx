import Link from "next/link";
import { ArrowRight, Bell, Check, CheckCheck, Clock3, Sun } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link className="brand" href="/" aria-label="Daymark home"><span className="brand-mark"><Sun size={18} /></span><span>daymark</span></Link>
        <div className="landing-links"><a href="#how-it-works">How it works</a><a href="#reminders">Reminders</a></div>
        <div className="landing-actions"><Link className="text-link" href="/auth">Sign in</Link><Link className="button button-primary" href="/today">Get started <ArrowRight size={16} /></Link></div>
      </nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="hero-note"><span className="hero-note-dot" />A little more room in your day</div>
          <h1>Keep the little things<br /><span>from slipping away.</span></h1>
          <p>One calm place for your daily tasks and the reminders that help you follow through.</p>
          <div className="hero-ctas"><Link className="button button-primary button-large" href="/today">Make a little plan <ArrowRight size={17} /></Link><Link className="button button-quiet button-large" href="/auth">I already have an account</Link></div>
          <div className="hero-proof"><span className="avatar-stack"><i>S</i><i>M</i><i>A</i></span><span>For the life you already have.</span></div>
        </div>
        <div className="hero-art" aria-label="Preview of a daily task list">
          <div className="art-glow" /><div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="preview-window">
            <div className="preview-top"><div className="preview-brand"><span className="brand-mark"><Sun size={14} /></span>daymark</div><span className="preview-date">THURSDAY, 19 NOV</span><div className="preview-avatar">S</div></div>
            <div className="preview-body"><div className="preview-eyebrow">YOUR THURSDAY</div><h2>Make space for<br />what matters.</h2><div className="preview-progress"><span className="progress-sun"><Sun size={16} /></span><div><strong>2 of 5 done</strong><small>You’re finding your rhythm</small></div><div className="mini-ring">40%</div></div>
              <div className="preview-tasks"><div className="preview-task"><span className="task-tick done"><Check size={12} /></span><span className="struck">Pack lunch for work</span><small>7:15</small></div><div className="preview-task"><span className="task-tick" /><span>Take smoothie with me</span><small className="reminder-time"><Bell size={12} /> 7:30</small></div><div className="preview-task"><span className="task-tick" /><span>Send the project note</span><small>10:00</small></div></div>
              <div className="preview-add"><span>+</span>Add one thing to your day</div>
            </div>
          </div>
          <div className="reminder-float"><span className="float-icon"><Bell size={15} /></span><div><strong>Time to go</strong><small>Take your smoothie with you</small></div><span className="float-time">7:30</span></div>
          <div className="sticker-check"><CheckCheck size={17} /></div>
        </div>
      </section>
      <section id="how-it-works" className="landing-band"><div><span className="band-icon"><Check size={17} /></span><strong>Keep today simple</strong><span>A short list that feels possible to finish.</span></div><div id="reminders"><span className="band-icon band-icon-sun"><Bell size={16} /></span><strong>Remember at the right moment</strong><span>Set a time. Get a nudge when it matters.</span></div><div><span className="band-icon band-icon-green"><Clock3 size={16} /></span><strong>Build a steady rhythm</strong><span>Daily and weekly tasks come back for you.</span></div></section>
      <footer className="landing-footer"><Link className="brand" href="/"><span className="brand-mark"><Sun size={17} /></span><span>daymark</span></Link><span>A gentle place to keep your day in view.</span><Link href="/auth">Open Daymark <ArrowRight size={14} /></Link></footer>
    </main>
  );
}
