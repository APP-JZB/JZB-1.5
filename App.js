import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, BackHandler, Linking, StyleSheet, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const PORTAL='https://app-jzb.github.io/JZB-1.5/';
// The existing portal downloads private documents as blob URLs. Export those bytes
// through Android's share sheet; credentials and access tokens never cross the bridge.
const DOWNLOAD_BRIDGE=`(function(){if(window.__jzbDownloads)return;window.__jzbDownloads=true;document.addEventListener('click',async function(e){const a=e.target.closest&&e.target.closest('a[download]');if(!a||!a.href.startsWith('blob:'))return;e.preventDefault();e.stopImmediatePropagation();try{const blob=await(await fetch(a.href)).blob();if(blob.size>10485760)throw new Error('size');const reader=new FileReader();reader.onload=function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'document',name:a.download||'documento',data:reader.result}));};reader.readAsDataURL(blob);}catch(error){window.ReactNativeWebView.postMessage(JSON.stringify({type:'download-error'}));}},true);})();true;`;
export default function App(){
 const web=useRef(null),canBack=useRef(false),sharing=useRef(false);
 const [key,setKey]=useState(0),[error,setError]=useState(false);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(canBack.current){web.current?.goBack();return true;}return false;});return()=>sub.remove();},[]);
 async function receive(event){
  if(!event.nativeEvent.url?.startsWith(PORTAL)||sharing.current)return;
  let file;
  try{const message=JSON.parse(event.nativeEvent.data);if(message.type==='download-error')throw new Error('download');if(message.type!=='document')return;
   if(typeof message.data!=='string'||message.data.length>15000000||!/^data:[^,]*;base64,/.test(message.data))throw new Error('format');
   sharing.current=true;const name=String(message.name||'documento').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-180)||'documento';
   const dir=FileSystem.cacheDirectory+'jzb-downloads/';await FileSystem.makeDirectoryAsync(dir,{intermediates:true});file=dir+Date.now()+'-'+name;
   await FileSystem.writeAsStringAsync(file,message.data.split(',')[1],{encoding:FileSystem.EncodingType.Base64});
   if(!await Sharing.isAvailableAsync())throw new Error('sharing');await Sharing.shareAsync(file,{dialogTitle:'Guardar o compartir documento JZB'});
  }catch(e){Alert.alert('Documento','No fue posible abrir el documento. Puedes volver a intentarlo o descargarlo desde el portal en tu navegador.');}
  finally{sharing.current=false;if(file)FileSystem.deleteAsync(file,{idempotent:true}).catch(()=>{});}
 }
 return <SafeAreaProvider><StatusBar style="light"/><SafeAreaView style={styles.root}>
  <View style={styles.bar}><Text style={styles.title}>JZB</Text><Pressable accessibilityRole="button" onPress={()=>{setError(false);setKey(k=>k+1);}}><Text style={styles.action}>Actualizar</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>Linking.openURL(PORTAL).catch(()=>Alert.alert('JZB','No se pudo abrir el navegador.'))}><Text style={styles.action}>Navegador</Text></Pressable></View>
  {error?<View style={styles.center}><Text style={styles.notice}>No fue posible cargar el portal. Revisa tu conexión a internet y pulsa Actualizar.</Text></View>:<WebView key={key} ref={web} source={{uri:PORTAL}} style={styles.web} javaScriptEnabled domStorageEnabled cacheEnabled={false} mixedContentMode="never" allowFileAccess={false} setSupportMultipleWindows={false} injectedJavaScript={DOWNLOAD_BRIDGE} onMessage={receive} onNavigationStateChange={s=>{canBack.current=s.canGoBack;}} onShouldStartLoadWithRequest={r=>{if(r.url==='about:blank'||r.url.startsWith(PORTAL)||r.url.startsWith('blob:'))return true;if(/^https:\/\//.test(r.url))Linking.openURL(r.url).catch(()=>{});return false;}} onError={()=>setError(true)} onHttpError={e=>{if(e.nativeEvent.url.startsWith(PORTAL)&&e.nativeEvent.statusCode>=400)setError(true);}} startInLoadingState renderLoading={()=><View style={styles.loading}><ActivityIndicator size="large" color="#1f5d4c"/></View>}/>}
 </SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#173e33'},bar:{flexDirection:'row',alignItems:'center',gap:20,padding:14},title:{color:'white',fontSize:20,fontWeight:'800',flex:1},action:{color:'white',paddingVertical:6},web:{flex:1,backgroundColor:'#f4f7f5'},center:{flex:1,justifyContent:'center',padding:28,backgroundColor:'#f4f7f5'},notice:{fontSize:17,lineHeight:26},loading:{position:'absolute',top:80,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center',backgroundColor:'#f4f7f5'}});
