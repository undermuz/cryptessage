import { Link } from "@tanstack/react-router";

export const IndexPage = () => {
    return (
        <div>
            Home page
            <Link to="/nested-page">Nested page</Link>
        </div>
    );
};
