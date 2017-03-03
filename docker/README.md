# ubuntu/firefox/cmdlnprint docker image

To use:

```
git clone https://github.com/eclipxe13/cmdlnprint.git
cd cmdlnprint/docker
docker build -t cmdlnprint:latest ./
mkdir -p cmdlnprint_shared/output
docker run --rm --volume `pwd`/cmdlnprint_shared/:/home/firefox/shared cmdlnprint:latest firefox -print https://google.com -print-mode pdf -print-file /home/firefox/shared/output/google.pdf
```

Your file should now be in `cmdlnprint_shared/output/`

Note that firefox will *NOT* be able to write to /home/firefox/shared inside the container because of [this known issue](https://github.com/docker/docker/issues/3124).

# Batteries included and replacible

There are several defaults that are reasonable choices that can be overridden

## Image build args

The following can be overridden at docker build time with the `--build-arg ARG=value.  So if you wanted to build firefox version 45 (this combiniation does not currently work but perhaps you want to see that) you could build with `docker build --build-arg FIREFOX_VERSION=45 -t cmdlnprint:104_45 ./`

```
FIREFOX_VERSION=51
GIT_REPO=https://github.com/eclipxe13/cmdlnprint.git
GIT_BRANCH=master
```
## Container environment variables

The following can be overridden at docker run time with `-e VAR=value`

```
HOME=${HOME-/home/firefox}
DISPLAY=${DISPLAY-}
```

Modifying DISPLAY to a local x server is helpful for debugging.  On a mac I will first setup a proxy to my x server (requires xquartz and socat; if your installation is missing either of these utilities, they are both available from brew):

```
export DOCKER_DISPLAY=`ifconfig en0 | fgrep 'inet ' | awk '{print $2}'`:0;
xhost +local:docker && \
echo "Docker DISPLAY should be set to: $DOCKER_DISPLAY" && \
socat TCP-LISTEN:6000,reuseaddr,fork UNIX-CLIENT:\"$DISPLAY\" &
```

Then I will run firefox like this (note that firefox will not exit because of the jsconsole window but eventually socat will timeout):

```
docker run --rm --volume `pwd`/cmdlnprint_shared/:/home/firefox/shared -e "DISPLAY=${DOCKER_DISPLAY}" cmdlnprint:latest firefox --jsconsole -print-info -print https://google.com -print-mode pdf -print-file /home/firefox/shared/output/google.pdf
```