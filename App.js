import React, { useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { DEFAULT_PET, PETS, applyDecay, byTime, getMood, isDone, isLate, say, todayStr } from "./pets.js";
import Mascot from "./Mascot.js";
const friendlyErrors = {
    "auth/popup-closed-by-user": "A janela do Google foi fechada. Tente de novo.",
    "auth/cancelled-popup-request": "Tente de novo.",
    "auth/unauthorized-domain": "Este site ainda não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).",
    "auth/operation-not-allowed": "O login com Google ainda não foi ativado no Firebase.",
    "auth/network-request-failed": "Sem conexão. Verifique a internet.",
    "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo."
};
function getErrorMessage(error) {
    return friendlyErrors[error?.code] || error?.message || "Não foi possível concluir. Tente novamente.";
}
function getLevelProgress(petData) {
    return Math.max(0, Math.min(100, petData.xp || 0));
}
const getPetMood = (d, p, anim) => say(p, getMood(d, anim));
export default function App() {
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [pet, setPet] = useState(PETS[0]);
    const [petData, setPetData] = useState(DEFAULT_PET);
    const [page, setPage] = useState("home");
    const [busy, setBusy] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [newTime, setNewTime] = useState("");
    const [newDaily, setNewDaily] = useState(false);
    const [allPets, setAllPets] = useState({});
    const [anim, setAnim] = useState(null);
    const [hearts, setHearts] = useState([]);
    const [now, setNow] = useState(new Date());
    const timers = useRef({});
    useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
    useEffect(() => { setAllPets((m) => ({ ...m, [pet.id]: petData })); }, [petData, pet.id]);
    useEffect(() => {
        if (!auth) {
            setAuthReady(true);
            return undefined;
        }
        return onAuthStateChanged(auth, (nextUser) => {
            setUser(nextUser);
            setAuthReady(true);
        });
    }, []);
    useEffect(() => {
        if (!user || !db)
            return;
        let cancelled = false;
        setLoadingData(true);
        setError("");
        Promise.all([loadTasks(user.uid), loadPets(user.uid)])
            .catch((err) => { if (!cancelled)
            setError(getErrorMessage(err)); })
            .finally(() => { if (!cancelled)
            setLoadingData(false); });
        return () => { cancelled = true; };
    }, [user]);
    async function loadTasks(uid = user?.uid) {
        if (!uid || !db)
            return;
        const snapshot = await getDocs(collection(db, "users", uid, "tasks"));
        setTasks(snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (isDone(a) - isDone(b)) || byTime(a, b) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }
    async function loadPets(uid = user?.uid) {
        if (!uid || !db)
            return;
        const stamp = Date.now();
        const entries = await Promise.all(PETS.map(async (p) => {
            const ref = doc(db, "users", uid, "pets", p.id);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                const d = { ...DEFAULT_PET, updatedAt: stamp };
                await setDoc(ref, d);
                return [p.id, d];
            }
            const d = applyDecay({ ...DEFAULT_PET, ...snap.data() }, stamp);
            if (d.updatedAt === stamp)
                setDoc(ref, d, { merge: true }).catch(() => { });
            return [p.id, d];
        }));
        const map = Object.fromEntries(entries);
        setAllPets(map);
        setPetData(map[pet.id] || DEFAULT_PET);
    }
    function flash(name, ms = 2200) {
        setAnim(name);
        clearTimeout(timers.current.anim);
        timers.current.anim = setTimeout(() => setAnim(null), ms);
    }
    function petThePet() {
        if (!user || !db)
            return;
        const next = { ...petData, happiness: Math.min(100, petData.happiness + 2), updatedAt: Date.now() };
        setPetData(next);
        flash("love", 1600);
        setHearts((h) => [...h.slice(-5), { id: Date.now() + Math.random(), x: `${25 + Math.random() * 50}%` }]);
        clearTimeout(timers.current.save);
        timers.current.save = setTimeout(() => setDoc(doc(db, "users", user.uid, "pets", pet.id), { happiness: next.happiness, updatedAt: next.updatedAt }, { merge: true }).catch(() => { }), 1200);
    }
    async function runAction(action, successMessage) {
        try {
            setBusy(true);
            setError("");
            setNotice("");
            await action();
            if (successMessage)
                setNotice(successMessage);
        }
        catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        }
        finally {
            setBusy(false);
        }
    }
    async function handleGoogle() {
        if (!auth)
            return setError("O Firebase ainda não foi configurado para este site.");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await runAction(async () => {
            try {
                await signInWithPopup(auth, provider);
            }
            catch (err) {
                if (err?.code === "auth/popup-blocked" || err?.code === "auth/operation-not-supported-in-this-environment") {
                    await signInWithRedirect(auth, provider);
                }
                else
                    throw err;
            }
        });
    }
    async function addTask(event) {
        event?.preventDefault();
        const title = newTask.trim();
        if (!title || !user || !db || busy)
            return;
        if (title.length > 120)
            return setError("A tarefa pode ter até 120 caracteres.");
        await runAction(async () => {
            await addDoc(collection(db, "users", user.uid, "tasks"), {
                title,
                time: newTime || null,
                daily: newDaily,
                completed: false,
                doneOn: null,
                createdAt: serverTimestamp()
            });
            setNewTask("");
            setNewTime("");
            setNewDaily(false);
            await loadTasks();
        }, "Tarefa adicionada ✨");
    }
    async function completeTask(task) {
        if (!user || !db || isDone(task) || busy)
            return;
        const totalXp = (petData.xp || 0) + 20;
        const updates = {
            xp: totalXp % 100,
            level: (petData.level || 1) + Math.floor(totalXp / 100),
            happiness: Math.min(100, (petData.happiness || 0) + 6),
            energy: Math.max(0, (petData.energy || 0) - 5),
            updatedAt: Date.now()
        };
        await runAction(async () => {
            const batch = writeBatch(db);
            batch.update(doc(db, "users", user.uid, "tasks", task.id), { completed: true, doneOn: todayStr(), completedAt: serverTimestamp() });
            batch.set(doc(db, "users", user.uid, "pets", pet.id), updates, { merge: true });
            await batch.commit();
            setPetData({ ...petData, ...updates });
            flash("love");
            await loadTasks();
        }, `Tarefa concluída! ${pet.name} ganhou carinho e experiência 🐾`);
    }
    async function removeTask(taskId) {
        if (!user || !db || busy)
            return;
        await runAction(async () => {
            await deleteDoc(doc(db, "users", user.uid, "tasks", taskId));
            await loadTasks();
        }, "Tarefa removida.");
    }
    async function careForPet(action) {
        if (!user || !db || busy)
            return;
        const changes = {
            feed: { satiety: Math.min(100, petData.satiety + 25), happiness: Math.min(100, petData.happiness + 4) },
            play: { energy: Math.max(0, petData.energy - 20), happiness: Math.min(100, petData.happiness + 14), xp: petData.xp + 5 },
            rest: { energy: Math.min(100, petData.energy + 35) },
            talk: { happiness: Math.min(100, petData.happiness + 3), xp: petData.xp + 2 }
        }[action];
        if (action === "play" && petData.energy < 15) {
            return setError(`${pet.name} precisa descansar antes de brincar.`);
        }
        if (action === "feed" && petData.satiety >= 100)
            return setNotice(`${pet.name} está de barriguinha cheia!`);
        const updates = { ...changes, lastCareAt: serverTimestamp(), updatedAt: Date.now() };
        flash({ feed: "eating", play: "play", rest: "sleepy", talk: "love" }[action]);
        await runAction(async () => {
            await setDoc(doc(db, "users", user.uid, "pets", pet.id), updates, { merge: true });
            const next = { ...petData, ...changes };
            if (next.xp >= 100) {
                next.xp -= 100;
                next.level += 1;
            }
            setPetData(next);
            if (next.xp !== changes.xp && changes.xp !== undefined) {
                await setDoc(doc(db, "users", user.uid, "pets", pet.id), { xp: next.xp, level: next.level }, { merge: true });
            }
        }, action === "feed" ? `${pet.name} adorou a comidinha 🍎` : action === "play" ? `Foi divertido brincar com ${pet.name}!` : action === "talk" ? `${pet.name}: “${pet.catch}”` : `${pet.name} está descansando 😴`);
    }
    if (!isFirebaseConfigured) {
        return React.createElement("main", { className: "setup-screen" },
            React.createElement("div", { className: "setup-card" },
                React.createElement("span", { className: "brand-mark" }, "\uD83D\uDCA7"),
                React.createElement("p", { className: "eyebrow" }, "UM MUNDO PARA CUIDAR"),
                React.createElement("h1", null, "Slimi Tasks"),
                React.createElement("p", null, "O app precisa ser conectado ao Firebase para voc\u00EA criar sua conta e salvar suas tarefas e pets."),
                React.createElement("div", { className: "setup-note" }, "Configura\u00E7\u00E3o do Firebase pendente. Assim que o app Web for ligado ao projeto, esta tela dar\u00E1 lugar ao login.")));
    }
    if (!authReady)
        return React.createElement("main", { className: "loading-screen" },
            React.createElement("span", { className: "spinner" }),
            "Preparando seu cantinho\u2026");
    if (!user) {
        return React.createElement("main", { className: "auth-screen" },
            React.createElement("div", { className: "auth-art", "aria-hidden": "true" },
                React.createElement("span", { className: "bubble bubble-one" }),
                React.createElement("span", { className: "bubble bubble-two" }),
                React.createElement("span", { className: "auth-pet" },
                    React.createElement(Mascot, { pet: PETS[0], mood: "happy", size: 190 })),
                React.createElement("span", { className: "sparkle sparkle-one" }, "\u2726"),
                React.createElement("span", { className: "sparkle sparkle-two" }, "\u2727")),
            React.createElement("section", { className: "auth-card" },
                React.createElement("div", { className: "brand-lockup" },
                    React.createElement("span", { className: "brand-mark small" }, "\uD83D\uDCA7"),
                    React.createElement("span", null, "Slimi Tasks")),
                React.createElement("p", { className: "eyebrow" }, "CRES\u00C7A NO SEU RITMO"),
                React.createElement("h1", null, "Que bom ter voc\u00EA aqui"),
                React.createElement("p", { className: "auth-description" }, "Rotinas com hor\u00E1rio, tarefas pequenas e um companheiro de Tempest esperando por voc\u00EA. Entre com sua conta Google \u2014 se for sua primeira vez, a conta \u00E9 criada automaticamente."),
                error && React.createElement("p", { className: "error", role: "alert" }, error),
                React.createElement("button", { className: "google-button", onClick: handleGoogle, disabled: busy },
                    React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 48 48", "aria-hidden": "true" },
                        React.createElement("path", { fill: "#EA4335", d: "M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" }),
                        React.createElement("path", { fill: "#4285F4", d: "M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" }),
                        React.createElement("path", { fill: "#FBBC05", d: "M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z" }),
                        React.createElement("path", { fill: "#34A853", d: "M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" })),
                    busy ? "Abrindo o Google…" : "Continuar com Google"),
                React.createElement("p", { className: "privacy-note" }, "Seus dados e seu progresso ficam guardados com seguran\u00E7a na sua conta.")));
    }
    const completedTasks = tasks.filter((task) => isDone(task)).length;
    const openTasks = tasks.filter((task) => !isDone(task)).sort(byTime);
    const dueNow = openTasks.filter((task) => isLate(task, now));
    const mood = getMood(petData, anim);
    const progress = getLevelProgress(petData);
    const greetingName = user.displayName?.split(" ")[0] || "amigo";
    return React.createElement("main", { className: "app-shell" },
        React.createElement("aside", { className: "sidebar" },
            React.createElement("a", { className: "brand-lockup", href: "#inicio", onClick: (event) => { event.preventDefault(); setPage("home"); } },
                React.createElement("span", { className: "brand-mark small" }, "\uD83D\uDCA7"),
                React.createElement("span", null, "Slimi Tasks")),
            React.createElement("p", { className: "sidebar-label" }, "SEU ESPA\u00C7O"),
            React.createElement("nav", { className: "main-nav", "aria-label": "Navega\u00E7\u00E3o principal" },
                React.createElement("button", { className: page === "home" ? "active" : "", onClick: () => setPage("home") },
                    React.createElement("span", null, "\u2302"),
                    " Vis\u00E3o geral"),
                React.createElement("button", { className: page === "tasks" ? "active" : "", onClick: () => setPage("tasks") },
                    React.createElement("span", null, "\u2713"),
                    " Minhas tarefas ",
                    React.createElement("i", null, openTasks.length)),
                React.createElement("button", { className: page === "pets" ? "active" : "", onClick: () => setPage("pets") },
                    React.createElement("span", null, "\u2661"),
                    " Meus companheiros")),
            React.createElement("div", { className: "sidebar-pet-card" },
                React.createElement("span", null,
                    React.createElement(Mascot, { pet: pet, mood: mood, size: 38 })),
                React.createElement("div", null,
                    React.createElement("strong", null, pet.name),
                    React.createElement("small", null,
                        "N\u00EDvel ",
                        petData.level)),
                React.createElement("span", { className: "online-dot" })),
            React.createElement("div", { className: "sidebar-footer" },
                React.createElement("span", { className: "avatar" }, greetingName.slice(0, 1).toUpperCase()),
                React.createElement("div", null,
                    React.createElement("strong", null, greetingName),
                    React.createElement("small", null, "seu espa\u00E7o seguro")),
                React.createElement("button", { className: "icon-button", title: "Sair da conta", "aria-label": "Sair da conta", onClick: () => signOut(auth) }, "\u2197"))),
        React.createElement("section", { className: "workspace" },
            React.createElement("header", { className: "topbar" },
                React.createElement("div", null,
                    React.createElement("p", { className: "eyebrow" }, "SEU CANTINHO, SEU RITMO"),
                    React.createElement("h1", null, page === "home" ? `Olá, ${greetingName}!` : page === "tasks" ? "Suas tarefas" : "Seus companheiros")),
                React.createElement("div", { className: "topbar-date" },
                    React.createElement("span", null, "\u2600"),
                    React.createElement("span", null, "Um passo de cada vez"))),
            error && React.createElement("p", { className: "error global-error", role: "alert" },
                error,
                React.createElement("button", { onClick: () => setError(""), "aria-label": "Fechar aviso" }, "\u00D7")),
            notice && React.createElement("p", { className: "success global-error", role: "status" },
                notice,
                React.createElement("button", { onClick: () => setNotice(""), "aria-label": "Fechar aviso" }, "\u00D7")),
            dueNow.length > 0 && React.createElement("p", { className: "due-banner", role: "status" },
                "\u23F0 ",
                pet.name,
                ": \u201CHora de ",
                dueNow[0].title,
                "!\u201D",
                dueNow.length > 1 && ` (e mais ${dueNow.length - 1})`),
            loadingData && React.createElement("p", { className: "loading-note" },
                React.createElement("span", { className: "spinner small-spinner" }),
                " Sincronizando seu progresso\u2026"),
            page === "home" && React.createElement(React.Fragment, null,
                React.createElement("section", { className: "hero-card", style: { "--pet-color": pet.color } },
                    React.createElement("div", { className: "hero-copy" },
                        React.createElement("span", { className: "hero-kicker" }, "SEU COMPANHEIRO DE HOJE"),
                        React.createElement("h2", null,
                            "Pequenas conquistas",
                            React.createElement("br", null),
                            "fazem dias felizes."),
                        React.createElement("p", null,
                            "Complete uma tarefa e celebre com ",
                            pet.name,
                            "."),
                        React.createElement("button", { className: "primary-button", onClick: () => setPage("tasks") },
                            "Ver minhas tarefas ",
                            React.createElement("span", null, "\u2192"))),
                    React.createElement("div", { className: "hero-creature", "aria-label": `${pet.name}, seu companheiro` },
                        React.createElement("span", null,
                            React.createElement(Mascot, { pet: pet, mood: mood, size: 150 })),
                        React.createElement("i", null, "\u2726"),
                        React.createElement("b", null, "\u2727")),
                    React.createElement("div", { className: "hero-stats" },
                        React.createElement("div", null,
                            React.createElement("span", null, "\u2726"),
                            React.createElement("strong", null,
                                "N\u00EDvel ",
                                petData.level),
                            React.createElement("small", null, "companheiro")),
                        React.createElement("div", null,
                            React.createElement("span", null, "\u2713"),
                            React.createElement("strong", null, completedTasks),
                            React.createElement("small", null, "tarefas conclu\u00EDdas")),
                        React.createElement("div", null,
                            React.createElement("span", null, "\u2661"),
                            React.createElement("strong", null,
                                petData.happiness,
                                "%"),
                            React.createElement("small", null, "felicidade")))),
                React.createElement("div", { className: "section-heading" },
                    React.createElement("div", null,
                        React.createElement("p", { className: "eyebrow" }, "UM POUQUINHO DE CADA VEZ"),
                        React.createElement("h2", null, "Seu dia est\u00E1 florescendo")),
                    React.createElement("button", { className: "quiet-button", onClick: () => setPage("tasks") },
                        "Ver tudo ",
                        React.createElement("span", null, "\u2192"))),
                React.createElement("div", { className: "dashboard-grid" },
                    React.createElement("section", { className: "surface daily-card" },
                        React.createElement("div", { className: "surface-heading" },
                            React.createElement("div", null,
                                React.createElement("span", { className: "heading-icon lilac" }, "\u2727"),
                                React.createElement("div", null,
                                    React.createElement("h3", null, "Pr\u00F3ximas tarefas"),
                                    React.createElement("p", null, "O que voc\u00EA quer realizar?"))),
                            React.createElement("button", { className: "add-icon", onClick: () => setPage("tasks"), "aria-label": "Adicionar tarefa" }, "\uFF0B")),
                        openTasks.slice(0, 3).map((task) => React.createElement("div", { className: "mini-task", key: task.id },
                            React.createElement("button", { className: "check-circle", onClick: () => completeTask(task), "aria-label": `Concluir ${task.title}` }, "\u2713"),
                            React.createElement("span", null, task.title),
                            task.time && React.createElement("small", { className: `time-tag ${isLate(task, now) ? "late" : ""}` },
                                "\u23F0 ",
                                task.time))),
                        !openTasks.length && React.createElement("div", { className: "empty-state compact" },
                            React.createElement("span", null, "\uD83C\uDF31"),
                            React.createElement("p", null,
                                "Nenhuma tarefa por agora.",
                                React.createElement("br", null),
                                "Que tal adicionar uma?"))),
                    React.createElement("section", { className: "surface bond-card" },
                        React.createElement("div", { className: "surface-heading" },
                            React.createElement("div", null,
                                React.createElement("span", { className: "heading-icon pink" }, "\u2661"),
                                React.createElement("div", null,
                                    React.createElement("h3", null, "Seu la\u00E7o especial"),
                                    React.createElement("p", null,
                                        "Voc\u00EA e ",
                                        pet.name))),
                            React.createElement("button", { className: "quiet-button", onClick: () => setPage("pets") },
                                "Cuidar ",
                                React.createElement("span", null, "\u2192"))),
                        React.createElement("div", { className: "bond-pet" },
                            React.createElement("span", null,
                                React.createElement(Mascot, { pet: pet, mood: mood, size: 58 })),
                            React.createElement("div", null,
                                React.createElement("strong", null, getPetMood(petData, pet, anim)),
                                React.createElement("div", { className: "level-track" },
                                    React.createElement("i", { style: { width: `${progress}%` } })),
                                React.createElement("small", null,
                                    progress,
                                    " / 100 de carinho para o pr\u00F3ximo n\u00EDvel"))),
                        React.createElement("div", { className: "bond-footer" },
                            React.createElement("span", null,
                                "\uD83C\uDF4E Barriguinha ",
                                React.createElement("b", null,
                                    petData.satiety,
                                    "%")),
                            React.createElement("span", null,
                                "\u26A1 Energia ",
                                React.createElement("b", null,
                                    petData.energy,
                                    "%")))))),
            page === "tasks" && React.createElement("section", { className: "surface tasks-page" },
                React.createElement("div", { className: "section-heading compact-heading" },
                    React.createElement("div", null,
                        React.createElement("p", { className: "eyebrow" }, "VOC\u00CA CONSEGUE"),
                        React.createElement("h2", null, "Um passo de cada vez \u2728"),
                        React.createElement("p", { className: "section-subtitle" }, "Cada tarefa conclu\u00EDda d\u00E1 experi\u00EAncia para seu companheiro.")),
                    React.createElement("span", { className: "task-count" },
                        openTasks.length,
                        " em aberto")),
                React.createElement("form", { className: "task-composer", onSubmit: addTask },
                    React.createElement("span", { className: "composer-icon" }, "\u270E"),
                    React.createElement("input", { value: newTask, onChange: (event) => setNewTask(event.target.value), maxLength: "120", placeholder: "Escreva uma tarefa que quer fazer\u2026", "aria-label": "Nova tarefa" }),
                    React.createElement("input", { type: "time", className: "time-input", value: newTime, onChange: (event) => setNewTime(event.target.value), "aria-label": "Hor\u00E1rio da rotina" }),
                    React.createElement("label", { className: "daily-check" },
                        React.createElement("input", { type: "checkbox", checked: newDaily, onChange: (event) => setNewDaily(event.target.checked) }),
                        " \uD83D\uDD01 Todo dia"),
                    React.createElement("button", { className: "primary-button", disabled: busy || !newTask.trim() },
                        "Adicionar tarefa ",
                        React.createElement("span", null, "\uFF0B"))),
                React.createElement("div", { className: "task-list" },
                    tasks.map((task) => React.createElement("article", { className: `task-row ${isDone(task) ? "is-complete" : ""}`, key: task.id },
                        React.createElement("button", { className: "check-circle", onClick: () => !isDone(task) && completeTask(task), disabled: isDone(task) || busy, "aria-label": isDone(task) ? "Tarefa concluída" : `Concluir ${task.title}` }, isDone(task) ? "✓" : ""),
                        React.createElement("div", { className: "task-copy" },
                            React.createElement("strong", null, task.title),
                            React.createElement("small", null, isDone(task) ? "Concluída · você conseguiu!" : "Uma pequena conquista esperando por você")),
                        task.time && React.createElement("span", { className: `time-tag ${isLate(task, now) ? "late" : ""}` },
                            "\u23F0 ",
                            task.time),
                        task.daily && React.createElement("span", { className: "time-tag daily" }, "\uD83D\uDD01 di\u00E1ria"),
                        !isDone(task) && React.createElement("span", { className: "xp-tag" }, "+20 XP"),
                        React.createElement("button", { className: "delete-task", onClick: () => removeTask(task.id), disabled: busy, "aria-label": `Excluir ${task.title}` }, "\u00D7"))),
                    !tasks.length && React.createElement("div", { className: "empty-state" },
                        React.createElement("span", null, "\uD83D\uDCDD"),
                        React.createElement("h3", null, "Sua lista come\u00E7a com uma ideia"),
                        React.createElement("p", null, "Adicione uma tarefa pequena e veja seu companheiro crescer com voc\u00EA."))),
                React.createElement("div", { className: "completed-summary" },
                    React.createElement("span", null, "\u2726"),
                    React.createElement("p", null,
                        "Voc\u00EA j\u00E1 concluiu ",
                        React.createElement("strong", null,
                            completedTasks,
                            " ",
                            completedTasks === 1 ? "tarefa" : "tarefas"),
                        ". Cada passo merece ser celebrado."))),
            page === "pets" && React.createElement("section", { className: "pets-page" },
                React.createElement("div", { className: "section-heading compact-heading" },
                    React.createElement("div", null,
                        React.createElement("p", { className: "eyebrow" }, "AMIZADES QUE CRESCEM"),
                        React.createElement("h2", null, "Escolha quem fica pertinho \uD83D\uDC3E"),
                        React.createElement("p", { className: "section-subtitle" }, "Cada companheiro tem seu jeitinho. Cuide de todos no seu tempo."))),
                React.createElement("div", { className: "pet-roster" }, PETS.map((item) => React.createElement("button", { key: item.id, className: `roster-card ${pet.id === item.id ? "selected" : ""}`, onClick: () => { setPet(item); setPetData(allPets[item.id] || DEFAULT_PET); setAnim(null); setError(""); }, style: { "--pet-color": item.color } },
                    React.createElement("span", { className: "roster-emoji" },
                        React.createElement(Mascot, { pet: item, mood: "happy", size: 40 })),
                    React.createElement("span", { className: "roster-info" },
                        React.createElement("strong", null, item.name),
                        React.createElement("small", null, item.description)),
                    React.createElement("span", { className: "roster-level" },
                        "Nv. ",
                        allPets[item.id]?.level || 1)))),
                React.createElement("section", { className: "surface care-panel", style: { "--pet-color": pet.color } },
                    React.createElement("div", { className: "care-portrait" },
                        React.createElement("span", { className: "care-sparkle one" }, "\u2726"),
                        React.createElement("span", { className: "care-sparkle two" }, "\u2727"),
                        React.createElement("button", { className: "care-creature pet-me", onClick: petThePet, "aria-label": `Fazer carinho em ${pet.name}` },
                            React.createElement(Mascot, { pet: pet, mood: mood, size: 140 }),
                            hearts.map((h) => React.createElement("i", { key: h.id, className: "heart-pop", style: { left: h.x } }, "\u2665"))),
                        React.createElement("div", { className: "mood-bubble" }, getPetMood(petData, pet, anim))),
                    React.createElement("div", { className: "care-content" },
                        React.createElement("p", { className: "eyebrow" }, "SEU COMPANHEIRO"),
                        React.createElement("h2", null, pet.name),
                        React.createElement("p", { className: "pet-personality" },
                            pet.personality,
                            " \u00B7 ",
                            pet.description),
                        React.createElement("div", { className: "level-display" },
                            React.createElement("div", null,
                                React.createElement("strong", null,
                                    "N\u00EDvel ",
                                    petData.level),
                                React.createElement("span", null,
                                    progress,
                                    " / 100 XP")),
                            React.createElement("div", { className: "level-track" },
                                React.createElement("i", { style: { width: `${progress}%` } }))),
                        React.createElement("div", { className: "care-meters" },
                            React.createElement(Meter, { icon: "\uD83C\uDF4E", label: "Barriguinha", value: petData.satiety }),
                            React.createElement(Meter, { icon: "\u2661", label: "Felicidade", value: petData.happiness }),
                            React.createElement(Meter, { icon: "\u26A1", label: "Energia", value: petData.energy })),
                        React.createElement("div", { className: "care-actions" },
                            React.createElement("button", { className: "care-button feed", onClick: () => careForPet("feed"), disabled: busy || petData.satiety >= 100 },
                                React.createElement("span", null, "\uD83C\uDF4E"),
                                React.createElement("strong", null,
                                    "Dar ",
                                    pet.food),
                                React.createElement("small", null, "+25 barriguinha")),
                            React.createElement("button", { className: "care-button play", onClick: () => careForPet("play"), disabled: busy || petData.energy < 15 },
                                React.createElement("span", null, "\uD83C\uDFBE"),
                                React.createElement("strong", null, "Brincar"),
                                React.createElement("small", null, "+14 felicidade \u00B7 +5 XP")),
                            React.createElement("button", { className: "care-button rest", onClick: () => careForPet("rest"), disabled: busy || petData.energy >= 100 },
                                React.createElement("span", null, "\uD83C\uDF19"),
                                React.createElement("strong", null, "Descansar"),
                                React.createElement("small", null, "+35 energia")),
                            React.createElement("button", { className: "care-button talk", onClick: () => careForPet("talk"), disabled: busy },
                                React.createElement("span", null, "\uD83D\uDCAC"),
                                React.createElement("strong", null, "Conversar"),
                                React.createElement("small", null, "+3 felicidade \u00B7 +2 XP"))),
                        React.createElement("p", { className: "pet-hint" },
                            "Toque em ",
                            pet.name,
                            " para fazer carinho \u2661"))),
                React.createElement("p", { className: "gentle-note" }, "\u2661 O progresso de cada companheiro \u00E9 salvo separadamente na sua conta.")),
            React.createElement("footer", { className: "workspace-footer" },
                React.createElement("span", null, "Feito com carinho"),
                React.createElement("span", null, "\uD83D\uDCA7"),
                React.createElement("span", null, "Seu progresso \u00E9 s\u00F3 seu"))));
}
function Meter({ icon, label, value = 0 }) {
    return React.createElement("div", { className: "meter" },
        React.createElement("div", null,
            React.createElement("span", null,
                icon,
                " ",
                label),
            React.createElement("strong", null,
                value,
                "%")),
        React.createElement("div", { className: "meter-track" },
            React.createElement("i", { style: { width: `${Math.max(0, Math.min(100, value))}%` } })));
}
