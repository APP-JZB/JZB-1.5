import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Platform, Alert, Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { supabase, fmtDay } from "./src/lib";
import { useData } from "./src/data";
import { avisosActivos, activarAvisos } from "./src/notify";
import { Usuarios, CambiarClave } from "./src/usuarios";
import { ObserverLogin, ObserverSession } from "./src/observador-acceso";
import { Dashboard, DASHBOARD_OWNER } from "./src/dashboard";
import { VistaTareas } from "./src/vistas-tareas";
import { Control } from "./src/control";
import { AREAS, UNIT_AREA } from "./src/catalog";
import { C, Btn, Note } from "./src/ui";
import { Procesos } from "./src/procesos";
import { Login, TaskDetail, TaskForm, CorregirTarea, PedirProrroga, DecidirProrroga, Resolver, EventForm, PostForm, MemberForm, NotificarSheet, PfNovedad, HoyAdmin, MisTareas, Calendario, Mural, Equipo, Notas, Asistente, ParteFuerza, Gantt, PlanEnlace } from "./src/screens";

const ADMIN_TABS = [["tareasboard", "Tareas"], ["hoy", "Hoy"], ["cal", "Calendario"], ["parte", "Parte"], ["equipo", "Equipo"], ["mural", "Mural"], ["ia", "IA"], ["control", "Control"], ["notas", "Notas"], ["enlace", "Plan de enlace"], ["gantt", "Gantt"]];
const MEMBER_TABS = [["tareas", "Mis tareas"], ["cal", "Calendario"], ["parte", "Parte"], ["mural", "Mural"], ["ia", "IA"], ["enlace", "Plan de enlace"], ["gantt", "Gantt"]];

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, gap: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink }}>Algo falló en Hito</Text>
        <Text selectable style={{ color: C.ink }}>{String(this.state.err && (this.state.err.stack || this.state.err.message || this.state.err)).slice(0, 1500)}</Text>
        <Text style={{ color: C.muted }}>Toma una captura de esta pantalla y envíasela a Claude.</Text>
        <Btn title="Reintentar" onPress={() => this.setState({ err: null })} />
      </ScrollView>);
  }
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [observerToken, setObserverToken] = useState(null);
  const [observerLogin, setObserverLogin] = useState(false);
  useEffect(() => { AsyncStorage.getItem("hito-observer-token").then(setObserverToken).catch(() => {}); }, []);
  const observerEnter = token => { AsyncStorage.setItem("hito-observer-token", token); setObserverToken(token); };
  const observerExit = () => { AsyncStorage.removeItem("hito-observer-token"); setObserverToken(null); setObserverLogin(false); };
  const [lastErr, setLastErr] = useState("");
  useEffect(() => { AsyncStorage.getItem("hito-last-error").then((v) => v && setLastErr(v)).catch(() => {}); }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
        {lastErr ? (
          <Pressable onPress={() => { AsyncStorage.removeItem("hito-last-error"); setLastErr(""); }} style={{ backgroundColor: "#FBE3E3", padding: 12 }}>
            <Text selectable style={{ color: "#7A1C1C", fontSize: 12 }}>La última vez Hito se cerró por este error (toma captura y envíasela a Claude; toca para ocultar):{"\n"}{lastErr.slice(0, 600)}</Text>
          </Pressable>) : null}
        <Boundary>
          {session === undefined ? <ActivityIndicator style={{ marginTop: 120 }} color={C.accent} /> : session ? <Main session={session} /> : observerToken ? <ObserverSession token={observerToken} onExit={observerExit} /> : observerLogin ? <ObserverLogin onLogin={observerEnter} onBack={() => setObserverLogin(false)} /> : <View style={{flex:1}}><Login /><View style={{padding:16}}><Btn title="Ingresar como observador" onPress={() => setObserverLogin(true)} /></View></View>}
        </Boundary>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Main({ session }) {
  const [d, reload] = useData(session);
  const [tab, setTab] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [avisos, setAvisos] = useState(true);
  useEffect(() => { avisosActivos().then(setAvisos); }, []);
  const [verProc, setVerProc] = useState(false);
  const meId = d.me && d.me.id;
  useEffect(() => { if (!meId) return; supabase.rpc("puede_ver_procesos").then(({ data, error }) => setVerProc(!error && data === true)); }, [meId]);
  if (!d.loaded) return <ActivityIndicator style={{ marginTop: 120 }} color={C.accent} />;
  if (!d.me) return (
    <View style={{ padding: 20, gap: 14, marginTop: 60 }}>
      <Note kind="bad" text="Tu cuenta no está vinculada a ninguna persona del encuadramiento. Habla con el Comandante." />
      <Btn title="Salir" onPress={() => supabase.auth.signOut()} />
    </View>);
  if (session.user.app_metadata?.hito_password_change_required) return <CambiarClave required admin={d.me.role === "admin"} />;
  const isAdmin = d.me.role === "admin";
  // Todos ven todas las pestañas: el Cdte modifica; supervisores ven toda la Zona; el resto ve su organización.
  const canDashboard = session.user.id === DASHBOARD_OWNER;
  const baseTabs = (isAdmin ? ADMIN_TABS : [["tareas", "Mis tareas"], ...ADMIN_TABS]).concat(verProc ? [["procesos", "Procesos"]] : []);
  const tabs = canDashboard
    ? [["dashboard", "Dashboard"], ...baseTabs.filter(([key]) => key !== "dashboard"), ...[["usuarios", "Usuarios"]]]
    : [...baseTabs, ["dashboard", "Dashboard"]];
  const sup = ["m-passalacqua", "m-azocar", "m-urquieta"].includes(d.me.id);
  const areaNom = ((AREAS.find((a) => a[0] === UNIT_AREA[d.me.parte_unit || d.me.unit]) || [])[1]) || "tu unidad";
  const cur = tabs.some(([key]) => key === tab) ? tab : tabs[0][0];
  const open = (s) => setSheet(s);
  const close = (next) => setSheet(next && next.kind ? next : null);
  const t = sheet && sheet.kind === "task" ? d.tasks.find((x) => x.id === sheet.id) : null;
  const titles = { usuarios: "Usuarios", dashboard: "Dashboard", tareasboard: "Tareas", hoy: "Hoy", tareas: "Mis tareas", cal: "Calendario", equipo: "Equipo", mural: "Diario mural", notas: "Notas", ia: "Asistente IA", parte: "Parte de fuerza", gantt: "Carta Gantt", control: "Control de gestión", procesos: "Procesos" };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: C.muted, letterSpacing: 0.8 }}>ZB ARICA · {fmtDay(Date.now()).toUpperCase()}</Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: C.ink }}>{titles[cur]}</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()} style={{ padding: 8 }}><Text style={{ color: C.muted, fontSize: 13 }}>Salir</Text></Pressable>
      </View>
      {d.error ? <View style={{ paddingHorizontal: 16 }}><Note kind="bad" text={d.error} /></View> : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}>
        {!avisos ? (
          <View style={{ backgroundColor: C.accentSoft, borderRadius: 14, padding: 14, gap: 10 }}>
            <Text style={{ color: C.ink, fontSize: 15 }}>Activa los avisos para recibir recordatorios de plazos en este celular.</Text>
            <Btn title="Activar avisos" kind="primary" onPress={async () => {
              const ok = await activarAvisos(true); setAvisos(!!ok);
              if (!ok) return Alert.alert("Avisos", "No se pudo activar. Revisa que la app tenga permiso de notificaciones en los ajustes del teléfono.");
              reload();
              if (Platform.OS === "android") Alert.alert("Un paso más para que lleguen con la app cerrada", "En Xiaomi, Huawei, Samsung y otros: Ajustes → Aplicaciones → Hito ZB Arica → Batería → “Sin restricciones” (o desactivar “Optimizar batería”).", [{ text: "Abrir ajustes", onPress: () => Linking.openSettings() }, { text: "Listo", style: "cancel" }]);
            }} />
          </View>) : null}
        {!isAdmin && ["hoy", "cal", "equipo", "control", "notas", "gantt"].includes(cur) ? <Note kind="info" text={sup ? "Modo consulta: ves toda la Zona. Solo el Comandante puede modificar." : "Ves la información de tu organización (" + areaNom + "). Solo el Comandante puede modificar."} /> : null}
        {cur === "usuarios" && canDashboard ? <Usuarios d={d} session={session} reload={reload} /> : null}
        {cur === "dashboard" ? <Dashboard session={session} revision={d.tasks} snapshot={canDashboard ? { tasks: d.tasks, members: d.members, as_of: new Date().toISOString() } : undefined} open={open} /> : null}
        {cur === "tareasboard" ? <VistaTareas d={d} open={open} /> : null}
        {cur === "hoy" ? <HoyAdmin d={d} open={open} ro={!isAdmin} /> : null}
        {cur === "tareas" ? <MisTareas d={d} open={open} /> : null}
        {cur === "cal" ? <Calendario d={d} open={open} isAdmin={isAdmin} /> : null}
        {cur === "equipo" ? <Equipo d={d} open={open} isAdmin={isAdmin} /> : null}
        {cur === "mural" ? <Mural d={d} open={open} isAdmin={isAdmin} /> : null}
        {cur === "notas" ? <Notas d={d} /> : null}
        {cur === "ia" ? <Asistente d={d} /> : null}
        {cur === "parte" ? <ParteFuerza d={d} /> : null}
        {cur === "enlace" ? <PlanEnlace d={d} isAdmin={isAdmin} /> : null}
        {cur === "gantt" ? <Gantt d={d} open={open} /> : null}
        {cur === "procesos" && verProc ? <Procesos d={d} /> : null}
        {cur === "control" ? <Control d={d} open={open} ro={!isAdmin} /> : null}
      </ScrollView>
      {(isAdmin && cur === "hoy") || (!isAdmin && cur === "tareas") ? (
        <Pressable onPress={() => open({ kind: "taskForm" })} style={{ position: "absolute", right: 16, bottom: 84, backgroundColor: C.accent, borderRadius: 28, paddingHorizontal: 20, height: 54, justifyContent: "center", elevation: 4 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>+ Nueva tarea</Text>
        </Pressable>) : null}
      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {tabs.map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flexGrow: 1, minWidth: tabs.length > 5 ? 74 : undefined, alignItems: "center", paddingVertical: 14, paddingHorizontal: 6, borderTopWidth: 2, borderColor: cur === k ? C.accent : "transparent" }} accessibilityRole="tab" accessibilityState={{ selected: cur === k }}>
              <Text style={{ fontSize: 12, fontWeight: cur === k ? "800" : "500", color: cur === k ? C.accent : C.muted }}>{l}</Text>
            </Pressable>))}
        </ScrollView>
      </View>
      {t ? <TaskDetail t={t} d={d} isAdmin={isAdmin} onClose={close} open={open} /> : null}
      {sheet && sheet.kind === "taskForm" ? <TaskForm t={sheet.t} d={d} onClose={close} /> : null}
      {sheet && sheet.kind === "corregir" ? <CorregirTarea t={sheet.t} d={d} onClose={close} /> : null}
      {sheet && sheet.kind === "pedirProrroga" ? <PedirProrroga t={sheet.t} d={d} onClose={close} /> : null}
      {sheet && sheet.kind === "decidir" ? <DecidirProrroga p={sheet.p} t={sheet.t} d={d} onClose={close} /> : null}
      {sheet && sheet.kind === "resolver" ? <Resolver t={sheet.t} d={d} onClose={close} /> : null}
      {sheet && sheet.kind === "event" ? <EventForm d={d} isAdmin={isAdmin} onClose={close} e={sheet.e} /> : null}
      {sheet && sheet.kind === "post" ? <PostForm onClose={close} d={d} /> : null}
      {sheet && sheet.kind === "member" ? <MemberForm m={sheet.m} d={d} onClose={close} /> : null}
      {sheet && sheet.kind === "ausencia" ? <PfNovedad d={d} self cols={(d.config.parte_cols && d.config.parte_cols.length ? d.config.parte_cols : [{ n: "Permiso" }, { n: "Feriado" }, { n: "Licencia médica" }, { n: "Comisión" }, { n: "Curso" }])} fecha={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} onClose={close} /> : null}
      {sheet && sheet.kind === "notificar" ? <NotificarSheet d={d} msg={sheet.msg} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

