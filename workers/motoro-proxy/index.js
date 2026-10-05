export default {
  async fetch(request, env) {
    const res = await env.ORIGIN.fetch(request);
    const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    if (cookies.length === 0) return res;
    res.headers.delete("Set-Cookie");
    for (const cookie of cookies) {
      res.headers.append("Set-Cookie", cookie.replace(/;\s*Domain=[^;]*/gi, ""));
    }
    return res;
  }
};
