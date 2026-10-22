// BMI = kg / m². Categories are the WHO adult ranges; they don't account for muscle mass.
const bmiValue = () => {
  const w = bodyweight(),
    h = height() / 100;
  return w > 0 && h > 0 ? Math.round((w / (h * h)) * 10) / 10 : null;
};
const bmiText = () => {
  const b = bmiValue();
  if (b == null) return '<span class=m>Enter weight and height to see your BMI.</span>';
  return `BMI <b>${b.toFixed(1)}</b> <span class=m>· ${b < 18.5 ? 'underweight' : b < 25 ? 'normal range' : b < 30 ? 'overweight range' : 'obese range'} (WHO ranges; muscle counts as weight)</span>`;
};
function renderSettings() {
  return `<button class=b data-a=back>‹ Back</button><h2 style="margin-top:12px">Settings</h2>
 <div class=card><b>You</b><div class=m>Bodyweight is used for exercises where the load includes bodyweight. Update it whenever it changes; logged sets keep the weight you had then.</div>
 <div class=body2><label>Weight<span class=row><input id=bwi type=number step=any inputmode=decimal placeholder="kg" aria-label="Bodyweight in kg" value="${bodyweight() || ''}"><span class=m>kg</span></span></label>
 <label>Height<span class=row><input id=hti type=number step=any inputmode=decimal placeholder="cm" aria-label="Height in cm" value="${height() || ''}"><span class=m>cm</span></span></label></div>
 <div class=bmi id=bmi>${bmiText()}</div></div>
 ${githubBackupCard()}
 <div class=card><b>Manual backup</b><div class=m>${lastBackupTime() ? 'Last backup ' + ageText(lastBackupTime()) : 'No backup yet'}. Export saves everything to one file (share it to Drive, iCloud or Files). Import replaces all current data.</div>
 <div class=row><button class=b data-a=backup>Export</button><button class=b data-a=restore>Import</button></div><input type=file id=imp accept=".json,application/json" hidden></div>
 <div class=card><b>App</b><div class=m>Lift Log <span id=verl>v${VER}</span></div><button class=b style="width:100%;margin-top:8px" data-a=upd id=updb>Check for updates</button></div>`;
}
