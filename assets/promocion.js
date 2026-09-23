(() => {
  const style = document.createElement('style');
  style.textContent = `.keiko-share{width:min(680px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:22px;border:0;border-radius:20px;color:#202020;background:white;font:16px system-ui;overflow:auto}.keiko-share::backdrop{background:#000b}.keiko-share h2{font:800 24px system-ui;margin:0 0 12px}.keiko-share label{display:block;margin:12px 0}.keiko-share select,.keiko-share textarea{box-sizing:border-box;width:100%;padding:10px;font:inherit;border:1px solid #ccc;border-radius:10px}.keiko-share img{display:block;max-width:100%;height:300px;object-fit:contain;margin:auto}.keiko-share nav{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.keiko-share button,.keiko-share a{display:inline-block;padding:12px;border:0;border-radius:10px;background:#eee;color:#222;font:700 14px system-ui;cursor:pointer;text-decoration:none}.keiko-share button.primary{background:#c8272c;color:white}.keiko-share button:disabled{opacity:.5}.keiko-share p{font:14px/1.5 system-ui;color:#555}`;
  document.head.append(style);
  const loadImage = src => new Promise((resolve,reject) => {const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('No se pudo cargar esta foto. Elige otra.'));image.src=src;});
  const wrap = (ctx,text,x,y,width,size,max=3) => {
    ctx.font=`800 ${size}px Arial`;let line='',lines=[];
    for(const word of String(text).split(/\s+/)){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>width&&line){lines.push(line);line=word;}else line=next;}lines.push(line);
    if(lines.length>max){lines=lines.slice(0,max);let last=lines[max-1];while(ctx.measureText(last+'…').width>width)last=last.slice(0,-1);lines[max-1]=last+'…';}
    lines.forEach((l,i)=>ctx.fillText(l,x,y+i*size*1.18));
  };
  const makeFile = async (product,src,story) => {
    const image=await loadImage(src),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=story?1920:1350;
    const c=canvas.getContext('2d'),h=canvas.height,top=story?180:0;
    c.fillStyle='#fff';c.fillRect(0,0,1080,h);
    c.fillStyle='#c8272c';c.fillRect(0,top,1080,120);c.fillStyle='#fff';c.font='800 44px Arial';c.fillText('MECÁNICA KEIKO',54,top+75);
    c.fillStyle='#e9a927';c.fillRect(0,top+120,1080,8);
    const y=top+160,boxH=story?820:600;
    // Recorta únicamente márgenes transparentes, nunca el producto.
    const scan=document.createElement('canvas');scan.width=image.naturalWidth;scan.height=image.naturalHeight;
    const sc=scan.getContext('2d',{willReadFrequently:true});sc.drawImage(image,0,0);
    const pixels=sc.getImageData(0,0,scan.width,scan.height).data;let l=scan.width,t=scan.height,r=-1,b=-1;
    for(let yy=0;yy<scan.height;yy++)for(let xx=0;xx<scan.width;xx++)if(pixels[(yy*scan.width+xx)*4+3]>32){l=Math.min(l,xx);r=Math.max(r,xx);t=Math.min(t,yy);b=Math.max(b,yy);}
    if(r<0)throw new Error('La foto está vacía. Elige otra fotografía.');
    const w=r-l+1,ih=b-t+1,scale=Math.min(940/w,boxH/ih);
    c.drawImage(image,l,t,w,ih,(1080-w*scale)/2,y+(boxH-ih*scale)/2,w*scale,ih*scale);
    const textY=y+boxH+65;c.fillStyle='#171717';wrap(c,product.name.toUpperCase(),54,textY,972,48,3);
    c.fillStyle='#c8272c';c.font='800 32px Arial';c.fillText(`CÓDIGO: ${product.code}`,54,textY+185);
    c.textAlign='right';c.fillStyle='#171717';c.fillText(product.price,1026,textY+185);c.textAlign='left';
    const footer=story?h-350:h-190;c.fillStyle='#f4f1eb';c.fillRect(0,footer,1080,story?200:190);
    c.fillStyle='#171717';c.font='800 30px Arial';c.fillText('CONSULTA Y RESERVA TU REPUESTO',54,footer+55);
    c.fillStyle='#158044';c.font='800 29px Arial';c.fillText('WhatsApp 098 938 1059',54,footer+102);
    c.fillStyle='#555';c.font='24px Arial';c.fillText('Archidona, Napo · Confirma compatibilidad',54,footer+146);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.93));
    if(!blob)throw new Error('No se pudo preparar la imagen.');
    return new File([blob],`keiko-${product.code}-${story?'historia':'publicacion'}.jpg`,{type:'image/jpeg'});
  };
  window.KEIKO_PROMOTION = { open(product) {
    const dialog=document.createElement('dialog');dialog.className='keiko-share';
    dialog.innerHTML='<h2>Comparte este repuesto</h2><button data-close type="button">Cerrar ×</button><label>Formato<select data-format><option value="post">Publicación · 1080 × 1350</option><option value="story">Historia · 1080 × 1920</option></select></label><label>Foto del producto<select data-photo></select></label><img data-preview alt="Vista previa de la promoción" hidden><p data-status role="status">Preparando imagen…</p><nav><button class="primary" data-share disabled>Compartir imagen en apps</button><button data-download disabled>Descargar imagen</button><button data-copy>Copiar texto y enlace</button><button data-link>Compartir solo enlace</button></nav><textarea data-text rows="5" aria-label="Texto para publicar"></textarea><nav><a data-facebook target="_blank" rel="noopener">Facebook: compartir enlace</a><a data-whatsapp target="_blank" rel="noopener">WhatsApp: enviar enlace</a></nav><p>Para Instagram, Facebook u otra app: comparte la imagen o descárgala y súbela como publicación, historia o mensaje. Pega el texto copiado; en historias añade el enlace con la opción de enlace de la app. Las apps disponibles las decide tu dispositivo; algunas reciben solo la foto.</p>';
    document.body.append(dialog);dialog.showModal();
    const q=s=>dialog.querySelector(s),status=q('[data-status]');let file,url,version=0;
    q('[data-text]').value=product.text;
    q('[data-facebook]').href=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(product.url)}`;
    q('[data-whatsapp]').href=`https://wa.me/?text=${encodeURIComponent(product.text)}`;
    (product.photos||[]).forEach((_,i)=>q('[data-photo]').add(new Option(`Foto ${i+1}${i===0?' · portada':''}`,i)));
    const prepare=async()=>{const current=++version;file=null;q('[data-share]').disabled=q('[data-download]').disabled=true;status.textContent='Preparando imagen…';try{
      const src=await product.resolvePhoto(Number(q('[data-photo]').value));
      const next=await makeFile(product,src,q('[data-format]').value==='story');if(current!==version||!dialog.open)return;
      file=next;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);q('[data-preview]').src=url;q('[data-preview]').hidden=false;q('[data-download]').disabled=false;
      const supported=!!(navigator.share&&navigator.canShare?.({files:[file]}));q('[data-share]').disabled=!supported;status.textContent=supported?'Lista. Ahora pulsa Compartir imagen para elegir una app.':'En este navegador descarga la imagen y copia el texto para publicarlos.';
    }catch(error){if(current===version)status.textContent=error.message;}};
    q('[data-format]').onchange=q('[data-photo]').onchange=prepare;
    q('[data-share]').onclick=()=>{if(!file)return;navigator.share({files:[file]}).then(()=>{status.textContent='Imagen entregada al menú de compartir. Completa la publicación en la app.';}).catch(e=>{if(e.name!=='AbortError')status.textContent='No se pudo abrir el menú. Descarga la imagen y copia el texto.';});};
    q('[data-download]').onclick=()=>{if(!file)return;const a=document.createElement('a');a.href=url;a.download=file.name;a.click();};
    q('[data-copy]').onclick=()=>navigator.clipboard.writeText(q('[data-text]').value).then(()=>status.textContent='Texto y enlace copiados.').catch(()=>{q('[data-text]').select();status.textContent='Selecciona y copia el texto manualmente.';});
    q('[data-link]').onclick=()=>{if(navigator.share)navigator.share({title:product.name,url:product.url}).catch(()=>{});else{q('[data-text]').select();status.textContent='Copia el enlace del texto o usa los botones de Facebook y WhatsApp.';}};
    q('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{version++;if(url)URL.revokeObjectURL(url);dialog.remove();});
    prepare();
  }};
})();
