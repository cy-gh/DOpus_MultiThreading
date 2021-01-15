# DOpus_MultiThreading
Multi-threaded wrapper for user commands for Directory Opus, using Script.Vars as async communication channel.

This is only a proof of concept, so take it as it is.



To test this, create a new button as such:

**@nodeselect**
**// MultiThreadManagerStart MAXCOUNT=24 MAXWAIT=60000 COMMAND "CalcSHA256"**
**// default MAXCOUNT is the number of logical processors, i.e. hyperthreaded ones**
**// default MAXWAIT is 1 hour in milliseconds**
**MultiThreadManagerStart COMMAND="CalcSHA256"**

Basically the command which needs to be run in parallel, "CalcSHA256" in this case, must at least have a parameter called
    **RESVAR (e.g. cmd.template='RESVAR/K, ...')**
and must set it before returning, e.g.
    **Script.vars.Set(resvar) = any_JS_value_object_etc;**
and the Thread Manager and Thread Workers will take care of the rest.

The reason why RESVAR is necessary is that there is no possibility for Script Commands to directly return a value with standard JS, i.e. 'return myval;' ...that doesn't work.

And since we run basically everything via 'dopusrt /acmd' anyway, the target command "CalcSHA256" is run completely asynchronously in a thread from which we would have no possibility to receive the return value.

Now you know.



## Application areas

There are many application areas apart from just hashing. There are many excellent CLI tools which process files but are single-threaded, e.g. various .PNG optimizers, ffmpeg, wget... These can be easily converted to multi-threaded workers now. Or you could write your own server pinger, web page fetchers and run it in parallel. If **it** can be run, now **it** can be run in parallel.

## Benchmarks

I did a very quick, rough benchmark; 4 files of total 15 GB on an AMD 3900x comparing single-thread vs multi-thread, where ST runtime is measured using "CalcSHA256" as a DOpus column.

RamDisk:
ST: ~57.8s
MT: ~22.3s
ST (2nd run right after MT): ~57.9s

NVME:
ST: ~63.2s
MT: ~22.4s
ST (2nd run right after MT): ~58.1s

So MT greatly increases hashing speed as long as you use a  non-spinning drive. If I had used more files, it probably would have helped even more; the CPU reached 18% max and quickly dropped as soon as some files were finished.

The number 18% is quite reasonable, on a 24 HT-core machine, the estimated CPU usage per core would be 100/24 =~ 4.2% if each core would process 1 file exclusively, and since I used 4 files, 18% sounds ok.

Also note the difference between approx. 60s in ST mode vs 22s in MT mode. The expected MT runtime is not as simple as dividing 60/4 = 15s and asking if it is the MT overhead. The difference comes not only from MT overhead but also depends on the longest running tasks, because the MT manager must wait at the very least for the longest running task (the biggest file to hash in this case) even if it were running for 1 file. To demonstrate this, I copied a file 8 times with different names, a total 17.6GB, then the runtime drops from 22.3s to 9.4s for a larger total size.

==> Multi-threading helps immensely, regardless of the MT overhead. 

## Screenshots

##### Button configuration

![./Screenshots/01.png](./Screenshots/01.png)

##### Progress window

![./Screenshots/02.png](./Screenshots/02.png)

##### Sample output

![./Screenshots/03.png](./Screenshots/03.png)