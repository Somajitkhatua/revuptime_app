const { spawn } = require('node:child_process');
const script = `import json, subprocess
ids = subprocess.check_output(['docker','ps','-q'],text=True).split()
if not ids:
 print(json.dumps({'matched':0})); raise SystemExit()
containers = json.loads(subprocess.check_output(['docker','inspect',*ids],text=True))
for c in containers:
 labels = c.get('Config',{}).get('Labels') or {}
 if not any('app.revuptime.com' in str(value) for value in labels.values()): continue
 env = dict(item.split('=',1) for item in c['Config'].get('Env',[]) if '=' in item)
 print(json.dumps({'id':c['Id'][:12],'name':c['Name'],'image':c['Config']['Image'],'workingDir':c['Config'].get('WorkingDir'),'model':env.get('OPENROUTER_MODEL'),'providerConfigured':bool(env.get('OPENROUTER_API_KEY')),'supabaseUrl':env.get('SUPABASE_URL'),'sharingEnabled':env.get('AI_ALLOW_LIVE_DATA')=='true','sharingOrganizationCount':len([x for x in env.get('AI_ALLOWED_ORGANIZATION_IDS','').split(',') if x.strip()]),'mounts':[{'source':m['Source'],'destination':m['Destination']} for m in c.get('Mounts',[])]}))
`;
const p = spawn('ssh', ['-i','C:/Users/khatu/.ssh/vps_key','-o','BatchMode=yes','-o','ConnectTimeout=10','root@194.164.150.143','python3 -'], {stdio:['pipe','inherit','inherit']});
p.stdin.end(script);
p.on('exit',code => process.exitCode = code || 0);
