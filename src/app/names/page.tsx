import Finder from './Finder';

export default function Names() {
  return (
    <>
      <h1>Handle finder</h1>
      <p className="sub">Brand-extension handle ideas for a client, checked against all three platforms.</p>
      <Finder />
      <div className="card" style={{ marginTop: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          <b>What the checks actually mean.</b> YouTube is checked for real: its profile URL returns
          404 for a free handle and 200 for a taken one. Instagram and TikTok both return 200 for
          every handle when you are not logged in, so there is no honest way to check them from here
          &mdash; those show a <b>check</b> link that opens the profile URL so you can look. Yahoo
          publishes no availability endpoint at all, so email addresses are shape-checked only and
          confirmed at signup. Even a &quot;free&quot; YouTube result is a strong signal rather than
          a guarantee, since platforms reserve names and hold recently-deleted handles.
        </p>
      </div>
    </>
  );
}
