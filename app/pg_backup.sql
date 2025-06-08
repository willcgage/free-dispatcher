--
-- PostgreSQL database cluster dump
--

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:GSmaNawFK8NE8cTcCq5Ncw==$e7C4V/4CKqM0xjdzly75Cqg6SOoD+bbiVXuZIzK8Kk0=:38y6gvWwAI7K/rom/lQUrJBnvJcxPZEjd/XD0eO77EA=';

--
-- User Configurations
--








--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

--
-- Database "dispatcher_db" dump
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: dispatcher_db; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE dispatcher_db WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE dispatcher_db OWNER TO postgres;

\connect dispatcher_db

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dispatchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispatchers (
    id integer NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.dispatchers OWNER TO postgres;

--
-- Name: dispatchers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dispatchers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.dispatchers_id_seq OWNER TO postgres;

--
-- Name: dispatchers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dispatchers_id_seq OWNED BY public.dispatchers.id;


--
-- Name: districts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.districts (
    id integer NOT NULL,
    name character varying NOT NULL,
    dispatcher_id integer
);


ALTER TABLE public.districts OWNER TO postgres;

--
-- Name: districts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.districts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.districts_id_seq OWNER TO postgres;

--
-- Name: districts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.districts_id_seq OWNED BY public.districts.id;


--
-- Name: module_endplates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.module_endplates (
    id integer NOT NULL,
    module_id integer NOT NULL,
    endplate_number integer NOT NULL,
    connected_module_id integer
);


ALTER TABLE public.module_endplates OWNER TO postgres;

--
-- Name: module_endplates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.module_endplates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.module_endplates_id_seq OWNER TO postgres;

--
-- Name: module_endplates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.module_endplates_id_seq OWNED BY public.module_endplates.id;


--
-- Name: modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modules (
    id integer NOT NULL,
    name character varying NOT NULL,
    district_id integer NOT NULL,
    number_of_endplates integer NOT NULL,
    owner character varying,
    owner_email character varying,
    is_yard boolean DEFAULT false NOT NULL
);


ALTER TABLE public.modules OWNER TO postgres;

--
-- Name: modules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.modules_id_seq OWNER TO postgres;

--
-- Name: modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.modules_id_seq OWNED BY public.modules.id;


--
-- Name: trains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trains (
    id integer NOT NULL,
    name character varying NOT NULL,
    status character varying
);


ALTER TABLE public.trains OWNER TO postgres;

--
-- Name: trains_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trains_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.trains_id_seq OWNER TO postgres;

--
-- Name: trains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trains_id_seq OWNED BY public.trains.id;


--
-- Name: dispatchers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatchers ALTER COLUMN id SET DEFAULT nextval('public.dispatchers_id_seq'::regclass);


--
-- Name: districts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts ALTER COLUMN id SET DEFAULT nextval('public.districts_id_seq'::regclass);


--
-- Name: module_endplates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.module_endplates ALTER COLUMN id SET DEFAULT nextval('public.module_endplates_id_seq'::regclass);


--
-- Name: modules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules ALTER COLUMN id SET DEFAULT nextval('public.modules_id_seq'::regclass);


--
-- Name: trains id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trains ALTER COLUMN id SET DEFAULT nextval('public.trains_id_seq'::regclass);


--
-- Data for Name: dispatchers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dispatchers (id, name) FROM stdin;
1	Will
2	Paul
3	Lee
\.


--
-- Data for Name: districts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.districts (id, name, dispatcher_id) FROM stdin;
1	Chanute	1
2	Coffeyville	2
3	Garnett	3
\.


--
-- Data for Name: module_endplates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.module_endplates (id, module_id, endplate_number, connected_module_id) FROM stdin;
1	1	1	3
2	1	2	2
3	3	1	1
\.


--
-- Data for Name: modules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.modules (id, name, district_id, number_of_endplates, owner, owner_email, is_yard) FROM stdin;
2	Iola	1	2	\N	\N	f
3	Thayer	1	2	\N	\N	f
4	Cherryvale	2	2	\N	\N	f
5	Coffeyville	2	2	\N	\N	f
6	Welda	3	2	\N	\N	f
7	Garnett	3	2	\N	\N	f
1	Chanute	1	1	Will Gage	willcgage@gmail.com	f
\.


--
-- Data for Name: trains; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trains (id, name, status) FROM stdin;
\.


--
-- Name: dispatchers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.dispatchers_id_seq', 3, true);


--
-- Name: districts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.districts_id_seq', 3, true);


--
-- Name: module_endplates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.module_endplates_id_seq', 3, true);


--
-- Name: modules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.modules_id_seq', 7, true);


--
-- Name: trains_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trains_id_seq', 1, false);


--
-- Name: dispatchers dispatchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatchers
    ADD CONSTRAINT dispatchers_pkey PRIMARY KEY (id);


--
-- Name: districts districts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_pkey PRIMARY KEY (id);


--
-- Name: module_endplates module_endplates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.module_endplates
    ADD CONSTRAINT module_endplates_pkey PRIMARY KEY (id);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: trains trains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trains
    ADD CONSTRAINT trains_pkey PRIMARY KEY (id);


--
-- Name: module_endplates uix_module_endplate; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.module_endplates
    ADD CONSTRAINT uix_module_endplate UNIQUE (module_id, endplate_number);


--
-- Name: ix_dispatchers_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_dispatchers_id ON public.dispatchers USING btree (id);


--
-- Name: ix_districts_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_districts_id ON public.districts USING btree (id);


--
-- Name: ix_module_endplates_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_module_endplates_id ON public.module_endplates USING btree (id);


--
-- Name: ix_modules_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_modules_id ON public.modules USING btree (id);


--
-- Name: ix_trains_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_trains_id ON public.trains USING btree (id);


--
-- Name: districts districts_dispatcher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.districts
    ADD CONSTRAINT districts_dispatcher_id_fkey FOREIGN KEY (dispatcher_id) REFERENCES public.dispatchers(id);


--
-- Name: module_endplates module_endplates_connected_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.module_endplates
    ADD CONSTRAINT module_endplates_connected_module_id_fkey FOREIGN KEY (connected_module_id) REFERENCES public.modules(id);


--
-- Name: module_endplates module_endplates_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.module_endplates
    ADD CONSTRAINT module_endplates_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id);


--
-- Name: modules modules_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id);


--
-- PostgreSQL database dump complete
--

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database cluster dump complete
--

