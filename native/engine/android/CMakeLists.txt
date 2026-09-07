cmake_minimum_required(VERSION 3.8)

option(APP_NAME "Project Name" "cocos-deeplink")
project(${APP_NAME} CXX)
set(CC_LIB_NAME cocos)
set(CC_PROJECT_DIR ${CMAKE_CURRENT_LIST_DIR})
set(CC_PROJ_SOURCES)
set(CC_COMMON_SOURCES)
set(CC_ALL_SOURCES)

include(${CMAKE_CURRENT_LIST_DIR}/../common/CMakeLists.txt)

cc_android_before_target(${CC_LIB_NAME})
add_library(${CC_LIB_NAME} SHARED ${CC_ALL_SOURCES})
cc_android_after_target(${CC_LIB_NAME})

# 16 KB page-size support (Android 15+, required by Google Play for new apps from
# Nov 2025). NDK r27 still links with 4 KB ELF segment alignment by default; force
# 16 KB so libcocos.so loads on 16 KB-page ARM64 devices. (NDK r28+ defaults to this.)
target_link_options(${CC_LIB_NAME} PRIVATE "-Wl,-z,max-page-size=16384" "-Wl,-z,common-page-size=16384")
