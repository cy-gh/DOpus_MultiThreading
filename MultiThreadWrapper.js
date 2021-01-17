// MultiThread Test
// (c) 2021 cuneytyilmaz.com

var util = {};
util.cmd		= DOpus.Create.Command;
util.sv			= Script.vars;
util.dopusrt	= 'dopusrt /acmd ';
util.shell		= new ActiveXObject('WScript.shell');
/*
	Proof of Concept - Multi-Threaded Commands

	To test this, create a new button as such:

	@nodeselect
	MultiThreadManagerStart MAXCOUNT=8 MAXWAIT=5000 COMMAND "CalcSHA256"

	Basically the command which needs to be run in parallel, "CalcSHA256" in this case,
	must at least have a parameter called
		RESVAR (e.g. cmd.template='RESVAR/K, ...')
	and must set it before returning, e.g.
		Script.vars.Set(resvar) = calculated_hash;
	and the Thread Manager and Thread Workers will take care of the rest.

	The reason why RESVAR is necessary is that there is no possibility for Script Commands
	to directly return a value with standard JS, i.e. 'return myval;' ...that doesn't work.

	And since we run basically everything via 'dopusrt /acmd' anyway,
	the target command "CalcSHA256" is run completely asynchronously in a thread
	from which we would have no possibility to receive the return value.
	Now you know.
*/

// Called by Directory Opus to initialize the script
function OnInit(initData)
{
	initData.name			= 'MultiThread Prototype';
	initData.version		= '1.0';
	initData.copyright		= '(c) 2021 cuneytyilmaz.com';
	initData.desc			= '';
	initData.default_enable	= true;
	initData.min_version	= '12.0';

	var cmd			= initData.AddCommand();
	cmd.name		= 'MultiThreadManagerStart';
	cmd.method		= 'OnMultiThreadManagerStart';
	cmd.template	= 'MAXCOUNT/N,MAXWAIT/N,COMMAND/K';
	cmd.label		= 'Multi-Thread Manager';
	cmd.desc		= 'Start Multi Threaded Command';

	var cmd			= initData.AddCommand();
	cmd.name		= 'MultiThreadWorker';
	cmd.method		= 'OnMultiThreadWorker';
	cmd.template	= 'THREADID/K,MAXWAIT/N,CMD/K,FILE/K';
	cmd.label		= 'Thread Worker - Do not call directly';
	cmd.desc		= 'Thread Worker - Do not call directly';

	var cmd			= initData.AddCommand();
	cmd.name		= 'CalcSHA256';
	cmd.method		= 'OnCalcSHA256';
	cmd.template	= 'RESVAR/K,FILE/K';
	cmd.label		= 'Calc SHA-256';
	cmd.desc		= 'not yet';
}


function getTS() {
	return new Date().getTime();
}
function getThreadID(ts) {
	return 't_' + ts + '_' + Math.floor(100 + Math.random() * 899);
}
function getResVar(tid) {
	return 'v_' + tid;
}

function OnMultiThreadManagerStart(scriptCmdData) {
	DOpus.ClearOutput();
	var cmd		= scriptCmdData.func.args.COMMAND;
	var maxcount= scriptCmdData.func.args.MAXCOUNT;
	var maxwait	= scriptCmdData.func.args.MAXWAIT;

	if (!cmd) {
		DOpus.Output('Cannot continue without a command');
		return;
	}
	if (!maxcount) {
		// %NUMBER_OF_PROCESSORS% gives the logical number of processors, i.e. hyperthreaded ones
		// for real core count use:
		// > WMIC CPU Get DeviceID,NumberOfCores,NumberOfLogicalProcessors
		// DeviceID  NumberOfCores  NumberOfLogicalProcessors
		// CPU0      12             24
		maxcount = util.shell.ExpandEnvironmentStrings("%NUMBER_OF_PROCESSORS%");
	}
	if (!maxwait) {
		// if no max wait given use 1 hour in millisecs
		maxwait = 60*60*1000;
	}
	DOpus.Output('Thread count: ' + maxcount + ', maxwait: ' + maxwait + ', command: ' + cmd);

	var maxwait_for_unfinished = maxwait; // make a param if you like

	var progress_bar = scriptCmdData.func.command.Progress;
    progress_bar.pause = true;
    progress_bar.abort = true;
    progress_bar.Init(scriptCmdData.func.sourcetab, 'Please wait');		// window title
	progress_bar.SetStatus('Running threads');							// header
	progress_bar.Show();
	progress_bar.SetFiles(scriptCmdData.func.sourcetab.selected_files.count);
	// progress_bar.HideFileByteCounts(false);
	// progress_bar.SetBytesProgress(DOpus.FSUtil.NewFileSize());
	progress_bar.Restart();


	util.sv.Set('TP') = DOpus.Create.Map();;	// clear
	var tp = util.sv.Get('TP');

	// runaway stoppers for while loops
	var itermax = 1000;
	var itercnt = 0;


	// process selected files
	var prefix = util.dopusrt + cmd;
	var current_count = 0;
	var totalcnt = 0;
	var selected_files_cnt = scriptCmdData.func.sourcetab.selstats.selfiles;
	fileloop: for (var eSelected = new Enumerator(scriptCmdData.func.sourcetab.selected), cnt = 1; !eSelected.atEnd(); eSelected.moveNext(), cnt++) {
		var selitem		= eSelected.item();
		var threadID	= getThreadID(getTS());
		var resvar		= getResVar(threadID);
		var prefix		= util.dopusrt + ' MultiThreadWorker THREADID="'+threadID+'" MAXWAIT='+maxwait+' CMD="'+cmd+'"';
		var torun		= prefix + ' FILE="' + selitem.realpath + '"';

		// DOpus.Output('*************** MANAGER: ' + prefix + ', file: ' + selitem.name);
		current_count++;
		// DOpus.Output('*************** Running #: ' + current_count);
		// DOpus.Output('');
		// DOpus.Output('');
		while(current_count > maxcount && ++itercnt < itermax) {
			DOpus.Delay(500);
			DOpus.Output('\ttoo many threads, waiting...: ' + current_count + ' (iter:'+itercnt+'), started so far: ' + totalcnt);
			var current_count = 0;
			for (var eTP = new Enumerator(tp); !eTP.atEnd(); eTP.moveNext()) {
				var thread = eTP.item();
				if (!tp(thread)('finished')) {
					// DOpus.Output('Unfinished file: ' + tp(thread)('file'));
					current_count++;
				}
			}
			DOpus.Output('\t...still running..: ' + current_count);
		}

		new_thread				= DOpus.Create.Map();
		new_thread('resvar')	= resvar;
		new_thread('cmd')		= cmd;
		new_thread('maxwait')	= maxwait;
		new_thread('file')		= selitem.realpath;
		new_thread('finished')	= false;
		new_thread('maxwait')	= maxwait;

		tp(threadID) = new_thread;
		util.sv.Set('TP') = tp;

		progress_bar.StepFiles(1);
		// progress_bar.StepBytes(selitem.size);
		DOpus.Output('selitem.size: ' + selitem.size);




		progress_bar.SetTitle(cnt + '/' + selected_files_cnt);
		progress_bar.SetName(selitem.name);
		progress_bar.SetType('file');
		switch (progress_bar.GetAbortState()) {
			case 'a':
				break fileloop;
			case 'p':
				while (progress_bar.GetAbortState() !== '') { DOpus.Delay(200); if (progress_bar.GetAbortState() === 'a') break fileloop; }
				break;
		}

		DOpus.Output('*************** Starting new thread after availability... ' + selitem.name + '\n\n');
		util.cmd.RunCommand(torun);
		totalcnt++;
		// uncomment this block only to test overall CPU load and ensure that it's approaching 100%
		// the results are irrelevant
		// calculate multiple hashes just to keep the CPU busy for a while
		/*
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
			util.cmdGlobal.RunCommand(torun);
		*/

		// DOpus.Output('');
		// DOpus.Output('');
	} // end fileloop

	// wait for unfinished files
	var ts = getTS()
	var all_finished = false;
	itercnt = 0;
	unfinished: while(!all_finished && ++itercnt < itermax && getTS() - ts < maxwait_for_unfinished) {
		DOpus.Delay(500);
		all_finished = true;
		for (var eTP = new Enumerator(tp); !eTP.atEnd(); eTP.moveNext()) {
			var thread = eTP.item();
			if (!tp(thread)('finished')) {
				// DOpus.Output('...waiting for unfinished file: ' + tp(thread)('file'));
				all_finished = false;
			}
			switch (progress_bar.GetAbortState()) {
				case 'a':
					break unfinished;
				case 'p':
					while (progress_bar.GetAbortState() !== '') { DOpus.Delay(200); if (progress_bar.GetAbortState() === 'a') break unfinished; }
					break;
			}
		}
	}

	progress_bar.ClearAbortState();
	progress_bar.Hide();

	// results ready, all threads finished/timed out
	//
	//
	// FROM THIS POINT ON, DO WHAT YOU WANT...
	//
	//
	//
	// Unfortunately any thread still running after this point will be unreachable
	//
	// Summary
	// DOpus.Output('');
	// DOpus.Output('');
	// DOpus.Output('');
	// DOpus.Output('*****************  SUMMARY');
	// DOpus.Output('');
	// DOpus.Output('');
	// DOpus.Output('');
	// for (var eTP = new Enumerator(tp); !eTP.atEnd(); eTP.moveNext()) {
	// 	var thread = eTP.item();
	// 	var rv = tp(thread)('resvar') + '';
	// 	var result = util.sv.Get(rv);
	// 	DOpus.Output('file: ' + tp(thread)('file') + ', resvar: ' + rv + ', finished: ' + tp(thread)('finished') + ', result: ' + result);
	// }
	DOpus.Output('Finished ' + totalcnt + ' files @' + getTS() + ', in ' + (getTS() - ts) + ' ms');
}


function OnMultiThreadWorker(scriptCmdData) {
	var cmd			= scriptCmdData.func.args.CMD;
	var threadID	= scriptCmdData.func.args.THREADID;
	var maxwait		= scriptCmdData.func.args.MAXWAIT;
	var file		= scriptCmdData.func.args.FILE;
	// DOpus.Output('\tWorker - threadID: ' + threadID + ', maxwait: ' + maxwait + ', cmd: ' + cmd + ', file: ' + file);

	var resvar = getResVar(threadID);
	var torun = cmd + ' RESVAR=' + resvar +' FILE="' + file + '"';

	util.sv.Set(resvar) = false;
	util.cmd.RunCommand(torun);

	var ts	= getTS();
	while (!util.sv.Get(resvar) && getTS() - ts < maxwait ) {
		DOpus.Delay(100);
	}
	util.sv.Set(resvar) = util.sv.Get(resvar) || false;	// put the result back to memory
	util.sv.Get('TP')(threadID)('finished') = true;		// mark the thread as finished

	// DOpus.Output('\tWorker - threadID: ' + threadID + ', elapsed: ' + Math.round((getTS()-ts)/1000) + 's, result: ' + util.sv.Get(resvar) + '\t\t' + util.sv.Get('TP')(threadID)('finished'));
}


function OnCalcSHA256(scriptCmdData) {
	var resvar	= scriptCmdData.func.args.RESVAR;
	if (!resvar) {
		DOpus.Output('\t\tOnCalcSHA256: Cannot continue without a resvar: ' + resvar);
		return;
	}

	var item	= DOpus.FSUtil.GetItem(scriptCmdData.func.args.FILE);
	var hash	= false;
	// DOpus.Output('\t\tOnCalcSHA256: ' + item.name + ', started @' + getTS());
	try {
		if (item.is_dir) return;
		hash = DOpus.FSUtil().Hash(item, 'sha256');
	} catch (e) {
		DOpus.Output('Error: ' + e.toString());
	}
	// DOpus.Output('\t\tOnCalcSHA256: ' + item.name + ', finished @' + getTS());

	util.sv.Set(resvar) = hash;
	// return hash; // this wouldn't work as you expected
}
