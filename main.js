import React, { Component } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("Slimi Tasks failed to render", error, info);
    }
    render() {
        if (this.state.error) {
            return React.createElement("main", { className: "loading-screen" },
                React.createElement("section", { className: "error-fallback" },
                    React.createElement("span", null, "\uD83D\uDEE0\uFE0F"),
                    React.createElement("h1", null, "Estamos arrumando uma coisinha"),
                    React.createElement("p", null, "Recarregue a p\u00E1gina em instantes. Se continuar, fale com quem administra o Slimi Tasks.")));
        }
        return this.props.children;
    }
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(React.StrictMode, null,
    React.createElement(AppErrorBoundary, null,
        React.createElement(App, null))));
