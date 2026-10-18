import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "../redux/store";
import RouteGuard from "../components/layout/RouteGuard";
import { setAuthStatus, setUserdata } from "../redux/userSlice";

/**
 * Rendering React Router's <Navigate> inside jsdom spins the worker thread in
 * this environment, so the redirect target is asserted through a spy instead.
 * The real redirect is verified in the browser smoke test.
 */
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Navigate: ({ to, replace }) => (
      <span data-testid="navigate" data-to={to} data-replace={String(Boolean(replace))} />
    ),
  };
});

const renderGuard = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/chat"]}>
        <RouteGuard>
          <p>Secret dashboard</p>
        </RouteGuard>
      </MemoryRouter>
    </Provider>,
  );

describe("RouteGuard", () => {
  it("redirects signed-out visitors to the login route", () => {
    store.dispatch(setAuthStatus("ready"));
    store.dispatch(setUserdata(null));

    renderGuard();

    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();
    const redirect = screen.getByTestId("navigate");
    expect(redirect).toHaveAttribute("data-to", "/login");
    expect(redirect).toHaveAttribute("data-replace", "true");
  });

  it("renders protected content for signed-in users", () => {
    store.dispatch(setUserdata({ _id: "user-1", credits: 42 }));

    renderGuard();

    expect(screen.getByText("Secret dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it("shows a booting state while the session resolves", () => {
    store.dispatch(setUserdata(null));
    store.dispatch(setAuthStatus("loading"));

    renderGuard();

    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });
});
