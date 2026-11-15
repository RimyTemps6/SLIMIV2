import React from "react";
const INK = "#2b2f4a";
function Face({ mood, x = 100, y = 100, gap = 26, my, eye = INK }) {
    const closed = mood === "sleepy";
    const joy = mood === "love" || mood === "play";
    const mouthY = my ?? y + 18;
    const eyes = [x - gap, x + gap].map((cx) => closed
        ? React.createElement("path", { key: cx, d: `M${cx - 9} ${y} Q${cx} ${y + 7} ${cx + 9} ${y}`, stroke: INK, strokeWidth: "3.5", fill: "none", strokeLinecap: "round" })
        : joy
            ? React.createElement("path", { key: cx, d: `M${cx - 9} ${y + 4} Q${cx} ${y - 9} ${cx + 9} ${y + 4}`, stroke: INK, strokeWidth: "3.5", fill: "none", strokeLinecap: "round" })
            : React.createElement("g", { key: cx },
                React.createElement("ellipse", { cx: cx, cy: y, rx: "8", ry: mood === "hungry" ? 7 : 10, fill: eye }),
                React.createElement("circle", { cx: cx + 3, cy: y - 3, r: "3", fill: "#fff" })));
    let mouth;
    if (mood === "hungry")
        mouth = React.createElement("ellipse", { cx: x, cy: mouthY, rx: "6", ry: "8", fill: "#7a3b4b" });
    else if (mood === "eating")
        mouth = React.createElement("ellipse", { className: "chew", cx: x, cy: mouthY, rx: "9", ry: "8", fill: "#7a3b4b" });
    else if (joy)
        mouth = React.createElement("path", { d: `M${x - 11} ${mouthY - 3} Q${x} ${mouthY + 16} ${x + 11} ${mouthY - 3}Z`, fill: "#7a3b4b" });
    else if (mood === "sleepy")
        mouth = React.createElement("path", { d: `M${x - 5} ${mouthY} h10`, stroke: INK, strokeWidth: "3", strokeLinecap: "round" });
    else
        mouth = React.createElement("path", { d: `M${x - 9} ${mouthY - 2} Q${x} ${mouthY + 8} ${x + 9} ${mouthY - 2}`, stroke: INK, strokeWidth: "3", fill: "none", strokeLinecap: "round" });
    return React.createElement("g", null,
        React.createElement("circle", { cx: x - gap * 1.35, cy: y + 12, r: "8", fill: "#ff8fa8", opacity: ".45" }),
        React.createElement("circle", { cx: x + gap * 1.35, cy: y + 12, r: "8", fill: "#ff8fa8", opacity: ".45" }),
        eyes,
        mouth,
        mood === "sleepy" && React.createElement("text", { className: "zzz", x: x + 40, y: y - 36 }, "z z"),
        mood === "love" && React.createElement("text", { x: x + 44, y: y - 40, fontSize: "22", fill: "#ff6f9f" }, "\u2665"));
}
function Slime({ p, mood }) {
    return React.createElement("g", null,
        React.createElement("path", { d: "M26 152 Q14 108 58 78 Q100 46 142 78 Q186 108 174 152 Q100 180 26 152Z", fill: p.color }),
        React.createElement("path", { d: "M26 152 Q100 180 174 152 Q176 164 100 172 Q24 164 26 152Z", fill: "#000", opacity: ".07" }),
        React.createElement("ellipse", { cx: "62", cy: "92", rx: "14", ry: "8", fill: "#fff", opacity: ".55", transform: "rotate(-30 62 92)" }),
        React.createElement(Face, { mood: mood, y: 122, gap: 30, my: 142 }));
}
function Chibi({ p, mood }) {
    return React.createElement("g", null,
        p.twin && React.createElement(React.Fragment, null,
            React.createElement("circle", { cx: "40", cy: "120", r: "21", fill: p.hair }),
            React.createElement("circle", { cx: "160", cy: "120", r: "21", fill: p.hair })),
        p.long && React.createElement("path", { d: "M46 92 Q36 178 68 172 L132 172 Q164 178 154 92Z", fill: p.hair }),
        React.createElement("path", { d: "M58 150 Q100 134 142 150 L150 196 H50Z", fill: p.outfit }),
        React.createElement("circle", { cx: "100", cy: "98", r: "50", fill: p.skin }),
        p.ear && React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M52 98 L22 78 L56 74Z", fill: p.skin }),
            React.createElement("path", { d: "M148 98 L178 78 L144 74Z", fill: p.skin })),
        React.createElement("path", { d: "M48 98 Q50 38 100 42 Q150 38 152 98 Q134 66 110 74 Q96 54 72 76 Q56 78 48 98Z", fill: p.hair }),
        p.horn && React.createElement("path", { d: "M92 48 L100 20 L108 48Z", fill: p.horn }),
        React.createElement(Face, { mood: mood, y: 106, gap: 27, eye: p.eye }));
}
function Beast({ p, mood }) {
    const dragon = p.kind === "dragon";
    return React.createElement("g", null,
        dragon && React.createElement(React.Fragment, null,
            React.createElement("path", { d: "M52 112 Q8 74 20 36 Q52 56 72 92Z", fill: p.accent }),
            React.createElement("path", { d: "M148 112 Q192 74 180 36 Q148 56 128 92Z", fill: p.accent })),
        React.createElement("ellipse", { cx: "100", cy: "168", rx: "46", ry: "30", fill: p.color }),
        React.createElement("ellipse", { cx: "100", cy: "158", rx: "28", ry: "20", fill: p.belly }),
        dragon
            ? React.createElement(React.Fragment, null,
                React.createElement("path", { d: "M64 62 Q50 30 34 22 Q50 52 80 62Z", fill: p.accent }),
                React.createElement("path", { d: "M136 62 Q150 30 166 22 Q150 52 120 62Z", fill: p.accent }))
            : React.createElement(React.Fragment, null,
                React.createElement("path", { d: "M52 80 L46 26 L90 58Z", fill: p.color }),
                React.createElement("path", { d: "M148 80 L154 26 L110 58Z", fill: p.color })),
        React.createElement("circle", { cx: "100", cy: "102", r: "54", fill: p.color }),
        !dragon && React.createElement("path", { d: "M100 52 L93 74 L107 74Z", fill: p.accent }),
        React.createElement("ellipse", { cx: "100", cy: "124", rx: "28", ry: "19", fill: p.belly }),
        React.createElement("ellipse", { cx: "100", cy: "115", rx: "8", ry: "5", fill: INK }),
        React.createElement(Face, { mood: mood, y: 94, gap: 28, my: 134, eye: dragon ? "#c58a00" : INK }));
}
export default function Mascot({ pet, mood = "happy", size = 150 }) {
    const a = pet.art;
    const Body = a.type === "slime" ? Slime : a.type === "beast" ? Beast : Chibi;
    return React.createElement("svg", { className: `mascot mood-${mood}`, viewBox: "0 0 200 200", width: size, height: size, role: "img", "aria-label": pet.name },
        React.createElement(Body, { p: a, mood: mood }));
}
