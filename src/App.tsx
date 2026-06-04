import { type Handle } from "@remix-run/ui";
import { Outlet } from "./provider/RouterProvider";

export function App(_handle: Handle) {
  return () => <Outlet />;
}
