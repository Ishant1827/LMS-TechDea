// Where each role lands after signing in, and the "home" its logo points to.
export function roleHome(role) {
  if (role === "admin" || role === "teacher") return "/teach";
  return "/";
}

export const isStaff = (role) => role === "teacher" || role === "admin";
