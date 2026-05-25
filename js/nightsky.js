/* NightSky — standalone vanilla JS canvas animation */
(function () {
  var canvas = document.createElement('canvas');
  canvas.id = 'ns-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block;';
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  var W, H;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  var STAR_COLORS = ['rgba(255,255,255,','rgba(200,220,255,','rgba(255,240,200,','rgba(180,200,255,','rgba(255,255,240,'];
  function seededRandom(seed) { var x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); }

  var NUM_STARS = 350;
  var stars = [];
  for (var i = 0; i < NUM_STARS; i++) {
    var colorBase = STAR_COLORS[Math.floor(seededRandom(i * 23) * STAR_COLORS.length)];
    stars.push({ x: seededRandom(i*3), y: seededRandom(i*5), radius: 0.3 + seededRandom(i*11)*1.4,
      opacity: 0.35 + seededRandom(i*19)*0.65, twinkleSpeed: 0.4 + seededRandom(i*29)*1.8,
      twinkleOffset: seededRandom(i*37)*Math.PI*2, color: colorBase });
  }

  var CONSTELLATIONS = [
    { nameRu:"Орион", labelStar:0,
      stars:[{x:.19,y:.52,r:2.8},{x:.23,y:.60,r:1.8},{x:.21,y:.68,r:1.6},{x:.16,y:.70,r:1.5},{x:.25,y:.56,r:1.4},{x:.28,y:.64,r:2.0},{x:.31,y:.64,r:2.0},{x:.34,y:.64,r:2.0},{x:.32,y:.56,r:1.4},{x:.36,y:.52,r:2.6},{x:.38,y:.60,r:1.6},{x:.40,y:.70,r:1.5}],
      lines:[[0,1],[1,2],[2,3],[0,4],[4,5],[5,6],[6,7],[4,8],[8,9],[9,10],[10,11],[7,10]] },
    { nameRu:"Б. Медведица", labelStar:0,
      stars:[{x:.52,y:.12,r:2.2},{x:.58,y:.14,r:2.0},{x:.64,y:.18,r:1.8},{x:.68,y:.14,r:2.0},{x:.74,y:.18,r:1.8},{x:.78,y:.22,r:1.9},{x:.82,y:.18,r:2.1}],
      lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[0,3]] },
    { nameRu:"М. Медведица", labelStar:0,
      stars:[{x:.62,y:.04,r:2.4},{x:.64,y:.10,r:1.5},{x:.66,y:.15,r:1.4},{x:.70,y:.09,r:1.8},{x:.72,y:.04,r:1.5},{x:.74,y:.08,r:1.4},{x:.76,y:.07,r:1.3}],
      lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[3,6]] },
    { nameRu:"Кассиопея", labelStar:1,
      stars:[{x:.78,y:.05,r:2.1},{x:.83,y:.08,r:2.3},{x:.87,y:.06,r:2.2},{x:.91,y:.09,r:2.0},{x:.95,y:.06,r:1.9}],
      lines:[[0,1],[1,2],[2,3],[3,4]] },
    { nameRu:"Скорпион", labelStar:0,
      stars:[{x:.55,y:.72,r:2.9},{x:.52,y:.68,r:1.7},{x:.49,y:.65,r:1.6},{x:.46,y:.63,r:1.5},{x:.43,y:.65,r:1.6},{x:.57,y:.68,r:1.7},{x:.60,y:.72,r:1.8},{x:.62,y:.77,r:1.7},{x:.64,y:.82,r:1.9},{x:.60,y:.86,r:1.6},{x:.56,y:.89,r:1.5}],
      lines:[[3,2],[2,1],[1,0],[0,5],[5,6],[6,7],[7,8],[8,9],[9,10],[4,3]] },
    { nameRu:"Лев", labelStar:0,
      stars:[{x:.42,y:.30,r:2.5},{x:.44,y:.25,r:1.8},{x:.47,y:.22,r:2.0},{x:.50,y:.24,r:1.6},{x:.52,y:.20,r:2.2},{x:.48,y:.28,r:1.5},{x:.46,y:.32,r:1.6}],
      lines:[[0,1],[1,2],[2,3],[3,4],[0,6],[6,5],[5,2]] },
    { nameRu:"Лебедь", labelStar:0,
      stars:[{x:.72,y:.35,r:2.7},{x:.70,y:.40,r:1.7},{x:.68,y:.45,r:2.0},{x:.66,y:.50,r:1.6},{x:.64,y:.43,r:1.5},{x:.72,y:.43,r:1.5}],
      lines:[[0,1],[1,2],[2,3],[4,2],[2,5]] },
    { nameRu:"Лира", labelStar:0,
      stars:[{x:.76,y:.38,r:2.8},{x:.78,y:.42,r:1.6},{x:.80,y:.44,r:1.5},{x:.76,y:.44,r:1.5},{x:.78,y:.46,r:1.4}],
      lines:[[0,1],[1,2],[2,4],[4,3],[3,1]] },
    { nameRu:"Близнецы", labelStar:0,
      stars:[{x:.28,y:.30,r:2.4},{x:.30,y:.32,r:2.5},{x:.26,y:.36,r:1.7},{x:.28,y:.38,r:1.6},{x:.26,y:.42,r:2.0},{x:.28,y:.44,r:1.8},{x:.24,y:.46,r:1.5},{x:.30,y:.46,r:1.5}],
      lines:[[0,2],[2,4],[4,6],[1,3],[3,5],[5,7],[6,7]] },
    { nameRu:"Персей", labelStar:0,
      stars:[{x:.10,y:.20,r:2.3},{x:.12,y:.16,r:1.8},{x:.14,y:.12,r:2.1},{x:.08,y:.24,r:1.7},{x:.06,y:.28,r:1.6},{x:.12,y:.26,r:1.5},{x:.14,y:.30,r:1.6}],
      lines:[[2,1],[1,0],[0,3],[3,4],[0,5],[5,6]] },
    { nameRu:"Телец", labelStar:0,
      stars:[{x:.10,y:.42,r:2.7},{x:.08,y:.38,r:1.6},{x:.06,y:.36,r:1.5},{x:.04,y:.40,r:1.4},{x:.12,y:.38,r:1.8},{x:.14,y:.34,r:1.6},{x:.13,y:.44,r:1.5}],
      lines:[[3,2],[2,1],[1,0],[0,4],[4,5],[0,6]] },
    { nameRu:"Б. Пёс", labelStar:0,
      stars:[{x:.30,y:.75,r:3.2},{x:.32,y:.80,r:1.8},{x:.28,y:.82,r:1.7},{x:.35,y:.77,r:1.6},{x:.36,y:.82,r:1.5}],
      lines:[[0,1],[1,2],[0,3],[3,4]] },
  ];

  var shootingStars = [];
  var nextShooting = 0;

  function spawnShootingStar() {
    var angle = 0.3 + Math.random() * 0.4;
    var speed = 6 + Math.random() * 8;
    shootingStars.push({
      x: Math.random() * W * 0.9, y: Math.random() * H * 0.4,
      vx: Math.cos(-angle) * speed, vy: Math.sin(angle) * speed,
      life: 0, maxLife: 55 + Math.random() * 35, length: 80 + Math.random() * 120,
    });
  }

  function drawNebula(x, y, w, h, r, g, b, alpha) {
    var grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h));
    grad.addColorStop(0, 'rgba('+r+','+g+','+b+','+alpha+')');
    grad.addColorStop(0.5, 'rgba('+r+','+g+','+b+','+(alpha*0.3)+')');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.scale(w / Math.max(w,h), h / Math.max(w,h));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc((x/w)*Math.max(w,h), (y/h)*Math.max(w,h), Math.max(w,h), 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);

    var skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#010912');
    skyGrad.addColorStop(0.35, '#061224');
    skyGrad.addColorStop(0.65, '#0a1b36');
    skyGrad.addColorStop(1, '#07122a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W*0.5, H*0.5);
    ctx.rotate(-0.35);
    var mw = ctx.createLinearGradient(-W, -H*0.15, W, H*0.15);
    mw.addColorStop(0, 'rgba(60,90,160,0)');
    mw.addColorStop(0.2, 'rgba(60,90,160,0.022)');
    mw.addColorStop(0.5, 'rgba(100,130,200,0.04)');
    mw.addColorStop(0.8, 'rgba(60,90,160,0.022)');
    mw.addColorStop(1, 'rgba(60,90,160,0)');
    ctx.fillStyle = mw;
    ctx.fillRect(-W*1.5, -H*0.22, W*3, H*0.44);
    ctx.restore();

    drawNebula(W*0.19, H*0.62, W*0.16, H*0.13, 100, 80, 200, 0.055);
    drawNebula(W*0.55, H*0.78, W*0.14, H*0.10, 180, 50, 50, 0.045);
    drawNebula(W*0.73, H*0.40, W*0.12, H*0.09, 50, 100, 200, 0.055);
    drawNebula(W*0.10, H*0.25, W*0.10, H*0.08, 80, 60, 180, 0.045);

    var t = time * 0.001;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var flicker = Math.sin(t * s.twinkleSpeed + s.twinkleOffset);
      var op = s.opacity * (0.75 + 0.25 * flicker);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.radius, 0, Math.PI*2);
      ctx.fillStyle = s.color + op + ')';
      ctx.fill();
      if (s.radius > 1.4) {
        var gg = ctx.createRadialGradient(s.x*W, s.y*H, 0, s.x*W, s.y*H, s.radius*3);
        gg.addColorStop(0, s.color + (op*0.35) + ')');
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(s.x*W, s.y*H, s.radius*3, 0, Math.PI*2);
        ctx.fillStyle = gg;
        ctx.fill();
      }
    }

    if (time > nextShooting) {
      spawnShootingStar();
      nextShooting = time + 3500 + Math.random() * 5000;
    }
    var alive = [];
    for (var j = 0; j < shootingStars.length; j++) {
      var ss = shootingStars[j];
      ss.life++;
      ss.x += ss.vx;
      ss.y += ss.vy;
      var progress = ss.life / ss.maxLife;
      var fadeIn = Math.min(1, ss.life / 8);
      var fadeOut = 1 - Math.max(0, (progress - 0.6) / 0.4);
      var alpha = fadeIn * fadeOut;
      if (alpha > 0.01 && ss.life < ss.maxLife) {
        var hyp = Math.hypot(ss.vx, ss.vy);
        var tailX = ss.x - ss.vx * (ss.length / hyp);
        var tailY = ss.y - ss.vy * (ss.length / hyp);
        var grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.7, 'rgba(200,220,255,'+(alpha*0.4)+')');
        grad.addColorStop(1, 'rgba(255,255,255,'+alpha+')');
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();
        var hg = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 6);
        hg.addColorStop(0, 'rgba(255,255,255,'+alpha+')');
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        alive.push(ss);
      } else if (ss.life < ss.maxLife) {
        alive.push(ss);
      }
    }
    shootingStars = alive;

    for (var c = 0; c < CONSTELLATIONS.length; c++) {
      var con = CONSTELLATIONS[c];
      ctx.save();
      ctx.strokeStyle = 'rgba(120,160,255,0.2)';
      ctx.lineWidth = 0.9;
      ctx.setLineDash([3, 6]);
      for (var l = 0; l < con.lines.length; l++) {
        var sa = con.stars[con.lines[l][0]], sb = con.stars[con.lines[l][1]];
        ctx.beginPath();
        ctx.moveTo(sa.x*W, sa.y*H);
        ctx.lineTo(sb.x*W, sb.y*H);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      for (var k = 0; k < con.stars.length; k++) {
        var cs = con.stars[k];
        var px = cs.x*W, py = cs.y*H;
        var flk = Math.sin(t*0.9 + cs.x*17 + cs.y*13);
        var cop = 0.75 + 0.25*flk;
        var glowRad = cs.r * 4;
        var cgg = ctx.createRadialGradient(px,py,0,px,py,glowRad);
        cgg.addColorStop(0, 'rgba(160,200,255,'+(0.32*cop)+')');
        cgg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(px, py, glowRad, 0, Math.PI*2);
        ctx.fillStyle = cgg;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, cs.r, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(230,240,255,'+cop+')';
        ctx.fill();
        if (cs.r >= 2.0) {
          ctx.beginPath();
          ctx.arc(px, py, cs.r*0.42, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(255,255,255,'+cop+')';
          ctx.fill();
        }
      }
      var ls = con.stars[con.labelStar];
      ctx.save();
      ctx.fillStyle = 'rgba(140,180,255,0.5)';
      ctx.font = (W < 768 ? '9' : '10') + "px Inter,system-ui,sans-serif";
      ctx.fillText(con.nameRu.toUpperCase(), ls.x*W + ls.r + 5, ls.y*H - ls.r - 4);
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
