package br.com.argousForms.protocolos;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.documentos.DocumentosService;
import br.com.argousForms.model.negocio.docs.PastaNegocio;
import br.com.argousForms.model.negocio.processos.EncaminhamentoNegocio;
import br.com.argousForms.model.negocio.processos.FormularioNegocio;
import br.com.argousForms.model.negocio.processos.FormularioVariavelNegocio;
import br.com.argousForms.model.negocio.processos.ProcotoloVariavelVersaoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoHTMLNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoHtmlParteNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoPDFNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoPdfCampoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloDocumentoVersaoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloEtapaDestinatarioNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloEtapaNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloGestorElegivelNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloRecursoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVariavelNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVersaoDocumentoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVersaoNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloVersaoVariavelNegocio;
import br.com.argousForms.model.persistencia.docs.Pasta;
import br.com.argousForms.model.persistencia.processos.Encaminhamento;
import br.com.argousForms.model.persistencia.processos.EncaminhamentoLocalizador;
import br.com.argousForms.model.persistencia.processos.Formulario;
import br.com.argousForms.model.persistencia.processos.FormularioLocalizador;
import br.com.argousForms.model.persistencia.processos.FormularioVariavel;
import br.com.argousForms.model.persistencia.processos.FormularioVariavelLocalizador;
import br.com.argousForms.model.persistencia.processos.ProcotoloVariavelVersao;
import br.com.argousForms.model.persistencia.processos.ProcotoloVariavelVersaoLocalizador;
import br.com.argousForms.model.persistencia.processos.Protocolo;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumento;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoHTML;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoHtmlParte;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoPDF;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoPDFLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoPdfCampo;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoVersao;
import br.com.argousForms.model.persistencia.processos.ProtocoloDocumentoVersaoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapa;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaDestinatario;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaDestinatarioLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloEtapaLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloGestorElegivel;
import br.com.argousForms.model.persistencia.processos.ProtocoloGestorElegivelLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloRecurso;
import br.com.argousForms.model.persistencia.processos.ProtocoloRecursoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloVariavel;
import br.com.argousForms.model.persistencia.processos.ProtocoloVariavelLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersao;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoDocumento;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoDocumentoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoLocalizador;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoVariavel;
import br.com.argousForms.model.persistencia.processos.ProtocoloVersaoVariavelLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.QtData;

public final class ProtocolosService {

	private final DocumentosService documentos = new DocumentosService();

	public JSONObject publicar( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		if( !usuario.papeis().contains( "GESTOR_DE_PROTOCOLOS" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode publicar Protocolos." );
		}
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersao;
				int numero;
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select v.ID_PROTOCOLO_VERSAO, coalesce((select max(p.NR_VERSAO) from Processos.PROTOCOLO_VERSOES p where p.ID_PROTOCOLO = v.ID_PROTOCOLO and p.NR_VERSAO > 0), 0) from Processos.PROTOCOLO_VERSOES v where v.ID_PROTOCOLO = ? and v.NR_VERSAO = -1 for update of v" ) ) {
					consulta.setObject( 1, idProtocolo );
					try ( ResultSet linha = consulta.executeQuery() ) {
						if( !linha.next() ) throw new ArgousFormsApiException( 404, "RASCUNHO_NAO_ENCONTRADO", "Não há rascunho para publicar." );
						idVersao = linha.getObject( 1, UUID.class );
						numero = linha.getInt( 2 ) + 1;
					}
				}
				if( numero > Short.MAX_VALUE ) throw new ArgousFormsApiException( 409, "LIMITE_VERSOES", "O Protocolo atingiu o limite de versões." );
				validarFluxoPublicavel( conexao, idVersao );
				if( !existeSql( conexao, "select 1 from Processos.PROTOCOLOS where ID_PROTOCOLO = ? and ID_PASTA is not null", idProtocolo ) ) {
					throw new ArgousFormsApiException( 409, "PASTA_OBRIGATORIA", "Escolha a pasta do Protocolo antes de publicar." );
				}
				if( existeSql( conexao, "select 1 from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x join Processos.PROTOCOLO_DOCUMENTO_VERSOES d on d.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO where x.ID_PROTOCOLO_VERSAO = ? and d.TP_MODELO = 'H'", idVersao ) ) {
					throw new ArgousFormsApiException( 409, "HTML_AINDA_NAO_PUBLICAVEL", "A geração de documentos HTML ainda não está disponível. Retire os modelos HTML deste rascunho antes de publicar." );
				}
				if( existeSql( conexao, "select 1 from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x join Processos.PROTOCOLO_DOCUMENTO_VERSOES d on d.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO left join Processos.PROTOCOLO_DOCUMENTO_PDF pdf on pdf.ID_PROTOCOLO_DOCUMENTO_VERSAO = d.ID_PROTOCOLO_DOCUMENTO_VERSAO left join Docs.ARQUIVO_VERSOES av on av.ID_ARQUIVO_VERSAO = pdf.ID_ARQUIVO_MODELO_PDF left join Docs.ARQUIVOS a on a.ID_ARQUIVO = av.ID_ARQUIVO where x.ID_PROTOCOLO_VERSAO = ? and (d.TP_MODELO <> 'P' or pdf.ID_ARQUIVO_MODELO_PDF is null or av.ID_ARQUIVO_VERSAO is null or a.CD_CONTENT_TYPE <> 'application/pdf' or a.DT_LIXEIRA is not null or a.DT_EXCLUSAO is not null)", idVersao ) ) {
					throw new ArgousFormsApiException( 409, "MODELO_INDISPONIVEL", "Um PDF do Protocolo está indisponível ou inválido." );
				}
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select d.ID_PROTOCOLO_DOCUMENTO_VERSAO from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x join Processos.PROTOCOLO_DOCUMENTO_VERSOES d on d.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO where x.ID_PROTOCOLO_VERSAO = ?" ) ) {
					consulta.setObject( 1, idVersao );
					try ( ResultSet linhas = consulta.executeQuery() ) {
						while( linhas.next() ) {
							ProtocoloDocumentoVersao documento = ProtocoloDocumentoVersaoLocalizador.buscaProtocoloDocumentoVersao( conexao, linhas.getObject( 1, UUID.class ) );
							if( documento.getDtPublicacao() == null ) {
								documento.setDtPublicacao( agora );
								new ProtocoloDocumentoVersaoNegocio( conexao, documento ).altera();
							}
						}
					}
				}
				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, idVersao );
				versao.setNrVersao( numero );
				versao.setTpSituacao( "P" );
				versao.setIdUsuarioPublicou( usuario.idUsuario() );
				versao.setDtPublicacao( agora );
				versao.setDtAlteracao( agora );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				Protocolo protocolo = ProtocoloLocalizador.buscaProtocolo( conexao, idProtocolo );
				protocolo.setSnAtivo( true );
				new ProtocoloNegocio( conexao, protocolo ).altera();
				conexao.commit();
				return new JSONObject().put( "idProtocolo", idProtocolo.toString() ).put( "numeroVersao", numero );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean existeSql( Conexao conexao, String sql, UUID id ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, id );
			try ( ResultSet linhas = consulta.executeQuery() ) { return linhas.next(); }
		}
	}

	private void validarFluxoPublicavel( Conexao conexao, UUID idVersao ) throws Exception {

		if( !existeSql( conexao, "select 1 from Processos.PROTOCOLO_GESTORES_ELEGIVEIS where ID_PROTOCOLO_VERSAO = ?", idVersao ) ) {
			throw new ArgousFormsApiException( 409, "GESTOR_ELEGIVEL_OBRIGATORIO", "Defina ao menos uma regra de gestor elegível antes de publicar." );
		}
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select count(*) filter (where not exists (select 1 from Processos.ENCAMINHAMENTOS caminho where caminho.ID_PROTOCOLO_VERSAO = etapa.ID_PROTOCOLO_VERSAO and caminho.ID_PROXIMA_ETAPA = etapa.ID_PROTOCOLO_ETAPA)), count(*) filter (where etapa.ID_ENCAMINHAMENTO is null) from Processos.PROTOCOLOS_ETAPAS etapa where etapa.ID_PROTOCOLO_VERSAO = ?" ) ) {
			consulta.setObject( 1, idVersao );
			try ( ResultSet linha = consulta.executeQuery() ) {
				linha.next();
				if( linha.getInt( 1 ) != 1 || linha.getInt( 2 ) < 1 ) {
					throw new ArgousFormsApiException( 409, "FLUXO_INCOMPLETO", "A publicação exige uma etapa inicial e ao menos uma etapa final." );
				}
			}
		}
		if( existeSql( conexao, "select 1 from Processos.PROTOCOLOS_ETAPAS e where e.ID_PROTOCOLO_VERSAO = ? and not exists (select 1 from Processos.PROTOCOLO_ETAPA_DESTINATARIOS d where d.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA)", idVersao ) ) {
			throw new ArgousFormsApiException( 409, "ETAPA_SEM_DESTINATARIO", "Defina ao menos um destinatário em cada etapa antes de publicar." );
		}
		if( existeSql( conexao, "select 1 from Processos.PROTOCOLOS_ETAPAS e cross join Cadastro.INSTITUICAO i where e.ID_PROTOCOLO_VERSAO = ? and i.ID_INSTITUICAO = 1 and not i.SN_PERMITIR_DESTINATARIOS_UNICOS and not exists (select 1 from Processos.PROTOCOLO_ETAPA_DESTINATARIOS d where d.ID_PROTOCOLO_ETAPA = e.ID_PROTOCOLO_ETAPA and (d.ID_GRUPO is not null or d.CD_TAG_GRUPO is not null or d.CD_TAG_USUARIO is not null or d.CD_TAG_VINCULO is not null))", idVersao ) ) {
			throw new ArgousFormsApiException( 409, "DESTINATARIO_NOMINAL", "A política da instituição exige uma regra de destinatários não limitada a um único usuário em cada etapa." );
		}
	}

	public JSONObject associarPasta( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idPasta ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String idVersao = exigirRascunho( conexao, usuario.idUsuario(), idProtocolo );
				if( idPasta != null ) documentos.exigirPastaParaProtocolo( conexao, usuario, idPasta );
				Protocolo protocolo = ProtocoloLocalizador.buscaProtocolo( conexao, idProtocolo );
				if( !Objects.equals( idPasta, protocolo.getIdPasta() ) && existe( conexao,
					"select 1 from Processos.PROTOCOLO_VERSAO_DOCUMENTOS where ID_PROTOCOLO_VERSAO = :id", UUID.fromString( idVersao ) ) ) {
					throw new ArgousFormsApiException( 409, "PASTA_COM_MODELOS", "Remova os modelos PDF antes de trocar a pasta do Protocolo." );
				}
				if( !Objects.equals( idPasta, protocolo.getIdPasta() ) && existe( conexao,
					"select 1 from Processos.PROTOCOLO_RECURSOS where ID_PROTOCOLO = :id", idProtocolo ) ) {
					throw new ArgousFormsApiException( 409, "PASTA_COM_RECURSOS", "Remova os recursos antes de trocar a pasta do Protocolo." );
				}
				protocolo.setIdPasta( idPasta );
				new ProtocoloNegocio( conexao, protocolo ).altera();
				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, UUID.fromString( idVersao ) );
				versao.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	public JSONObject salvarVariavel( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idVariavel, String codigoInformado, String nomeInformado, String tipoInformado, String descricaoInformada, JSONObject definicaoInformada ) throws Exception {

		exigirCriador( usuario );
		String codigo = codigoInformado == null ? "" : codigoInformado.strip();
		String nome = nomeInformado == null ? "" : nomeInformado.strip();
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		if( codigo.isEmpty() || codigo.length() > 100 || nome.isEmpty() || nome.length() > 255 || tipoInformado == null || !tipoInformado.matches( "[SIRMVBODHT]" ) ) {
			throw new ArgousFormsApiException( 400, "VARIAVEL_INVALIDA", "Informe código, nome e tipo válidos para a variável." );
		}
		String definicaoJson = definicaoInformada == null ? null : DefinicaoVariavelTexto.validar( tipoInformado, definicaoInformada ).toString();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String idVersao = exigirRascunho( conexao, usuario.idUsuario(), idProtocolo );
				JSONObject origem = definicaoInformada == null ? null : definicaoInformada.optJSONObject( "origem" );
				if( origem != null && "INSTITUICAO".equals( origem.optString( "tipo" ) )
					&& !variavelInstituicaoAtiva( conexao, origem.getInt( "idAtributo" ) ) ) {
					throw new ArgousFormsApiException( 400, "ATRIBUTO_INATIVO", "A variável da instituição não existe ou está inativa." );
				}
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				ProtocoloVariavel variavel;
				ProcotoloVariavelVersao definicao;
				boolean novaDefinicao = idVariavel == null;
				if( idVariavel == null ) {
					variavel = new ProtocoloVariavel();
					variavel.setIdProtocolo( idProtocolo );
					variavel.setDtInclusao( agora );
					variavel.setCdVariavel( codigo );
					variavel.setTpDado( tipoInformado );
					variavel.setDsDescricao( descricao.isEmpty() ? null : descricao );
					new ProtocoloVariavelNegocio( conexao, variavel ).insere();
					definicao = new ProcotoloVariavelVersao();
					definicao.setIdVariavel( variavel.getIdVariavel() );
					definicao.setNrVersao( 1 );
					definicao.setDtInclusao( agora );
					definicao.setJsDefinicao( definicaoJson == null ? "{}" : definicaoJson );
				} else {
					variavel = ProtocoloVariavelLocalizador.buscaProtocoloVariavel( conexao, idVariavel );
					if( variavel == null || !idProtocolo.equals( variavel.getIdProtocolo() ) ) {
						throw new ArgousFormsApiException( 404, "VARIAVEL_NAO_ENCONTRADA", "Variável não encontrada neste Protocolo." );
					}
					ProtocoloVersaoVariavel associacao = ProtocoloVersaoVariavelLocalizador.buscaPorProtocoloPorVariavel( conexao, UUID.fromString( idVersao ), idVariavel );
					if( associacao == null ) throw new ArgousFormsApiException( 404, "VARIAVEL_NAO_ENCONTRADA", "Variável não encontrada neste rascunho." );
					definicao = ProcotoloVariavelVersaoLocalizador.buscaPorVariaveisPorVersao( conexao, idVariavel, associacao.getNrVersao() );
					if( variavelPublicada( conexao, idVariavel ) ) {
						if( !codigo.equals( variavel.getCdVariavel() ) || !tipoInformado.equals( variavel.getTpDado() ) || !Objects.equals( descricao.isEmpty() ? null : descricao, variavel.getDsDescricao() ) ) {
							throw new ArgousFormsApiException( 409, "IDENTIDADE_VARIAVEL_IMUTAVEL", "Código, tipo e descrição de uma variável publicada não podem ser alterados." );
						}
						if( nome.equals( definicao.getDsNome() ) && mesmaDefinicao( definicao.getJsDefinicao(), definicaoJson == null ? definicao.getJsDefinicao() : definicaoJson ) ) {
							conexao.commit();
							return new JSONObject().put( "idVariavel", idVariavel.toString() );
						}
						if( definicaoPublicada( conexao, idVariavel, associacao.getNrVersao() ) ) {
							ProcotoloVariavelVersao anterior = definicao;
							definicao = new ProcotoloVariavelVersao();
							definicao.setIdVariavel( idVariavel );
							definicao.setNrVersao( proximaVersaoVariavel( conexao, idVariavel ) );
							definicao.setDtInclusao( agora );
							definicao.setJsDefinicao( anterior.getJsDefinicao() );
							novaDefinicao = true;
						}
					} else {
						variavel.setCdVariavel( codigo );
						variavel.setTpDado( tipoInformado );
						variavel.setDsDescricao( descricao.isEmpty() ? null : descricao );
						new ProtocoloVariavelNegocio( conexao, variavel ).altera();
					}
				}
				definicao.setDsNome( nome );
				if( definicaoJson != null ) definicao.setJsDefinicao( definicaoJson );
				if( novaDefinicao ) {
					new ProcotoloVariavelVersaoNegocio( conexao, definicao ).insere();
					if( idVariavel == null ) {
						ProtocoloVersaoVariavel associacao = new ProtocoloVersaoVariavel();
						associacao.setIdProtocoloVersao( UUID.fromString( idVersao ) );
						associacao.setIdVariavel( variavel.getIdVariavel() );
						associacao.setNrVersao( 1 );
						new ProtocoloVersaoVariavelNegocio( conexao, associacao ).insere();
					} else {
						ProtocoloVersaoVariavel associacao = ProtocoloVersaoVariavelLocalizador.buscaPorProtocoloPorVariavel( conexao, UUID.fromString( idVersao ), idVariavel );
						new ProtocoloVersaoVariavelNegocio( conexao, associacao ).exclui();
						ProtocoloVersaoVariavel novoVinculo = new ProtocoloVersaoVariavel();
						novoVinculo.setIdProtocoloVersao( UUID.fromString( idVersao ) );
						novoVinculo.setIdVariavel( idVariavel );
						novoVinculo.setNrVersao( definicao.getNrVersao() );
						new ProtocoloVersaoVariavelNegocio( conexao, novoVinculo ).insere();
					}
				} else new ProcotoloVariavelVersaoNegocio( conexao, definicao ).altera();

				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, UUID.fromString( idVersao ) );
				versao.setDtAlteracao( agora );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				conexao.commit();
				return new JSONObject().put( "idVariavel", variavel.getIdVariavel().toString() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean variavelPublicada( Conexao conexao, UUID idVariavel ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select x.ID_VARIAVEL from Processos.PROTOCOLO_VERSAO_VARIAVEIS x join Processos.PROTOCOLO_VERSOES v "
				+ "on v.ID_PROTOCOLO_VERSAO = x.ID_PROTOCOLO_VERSAO where x.ID_VARIAVEL = :variavel and v.NR_VERSAO > 0" );
			query.setParameter( "variavel", idVariavel.toString() );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	private boolean definicaoPublicada( Conexao conexao, UUID idVariavel, int nrVersao ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select x.ID_VARIAVEL from Processos.PROTOCOLO_VERSAO_VARIAVEIS x join Processos.PROTOCOLO_VERSOES v "
				+ "on v.ID_PROTOCOLO_VERSAO = x.ID_PROTOCOLO_VERSAO where x.ID_VARIAVEL = :variavel and x.NR_VERSAO = :versao and v.NR_VERSAO > 0" );
			query.setParameter( "variavel", idVariavel.toString() );
			query.setParameter( "versao", nrVersao );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	private boolean mesmaDefinicao( String anterior, String atual ) throws Exception {

		return mesmoValorJson( new JSONObject( anterior ), new JSONObject( atual ) );
	}

	private boolean mesmoValorJson( Object anterior, Object atual ) throws Exception {

		if( anterior instanceof JSONObject objetoAnterior && atual instanceof JSONObject objetoAtual ) {
			if( objetoAnterior.length() != objetoAtual.length() ) return false;
			
			Iterator itr = objetoAnterior.keys();
			
			while( itr.hasNext() ) {
				String chave = (String) itr.next();
				if( !objetoAtual.has( chave ) || !mesmoValorJson( objetoAnterior.get( chave ), objetoAtual.get( chave ) ) ) return false;
			}
			return true;
		}
		if( anterior instanceof JSONArray listaAnterior && atual instanceof JSONArray listaAtual ) {
			if( listaAnterior.length() != listaAtual.length() ) return false;
			for( int indice = 0; indice < listaAnterior.length(); indice++ ) {
				if( !mesmoValorJson( listaAnterior.get( indice ), listaAtual.get( indice ) ) ) return false;
			}
			return true;
		}
		if( anterior instanceof Number numeroAnterior && atual instanceof Number numeroAtual ) {
			return new BigDecimal( numeroAnterior.toString() ).compareTo( new BigDecimal( numeroAtual.toString() ) ) == 0;
		}
		return Objects.equals( anterior, atual );
	}

	private int proximaVersaoVariavel( Conexao conexao, UUID idVariavel ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select coalesce(max(NR_VERSAO), 0) + 1 from Processos.PROTOCOLO_VARIAVEL_VERSOES where ID_VARIAVEL = ?" ) ) {
			consulta.setObject( 1, idVariavel );
			try ( ResultSet linha = consulta.executeQuery() ) { linha.next(); return linha.getInt( 1 ); }
		}
	}

	public JSONObject criar( AutenticacaoLocalService.Usuario usuario, String tituloInformado, String descricaoInformada ) throws Exception {

		exigirCriador( usuario );
		String titulo = titulo( tituloInformado );
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		UUID id;
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				Protocolo protocolo = new Protocolo();
				protocolo.setIdUsuarioCriador( usuario.idUsuario() );
				protocolo.setDsTitulo( titulo );
				protocolo.setDsDescricao( descricao.isEmpty() ? null : descricao );
				protocolo.setDtInclusao( agora );
				protocolo.setSnAtivo( false );
				new ProtocoloNegocio( conexao, protocolo ).insere();

				ProtocoloVersao versao = new ProtocoloVersao();
				versao.setIdProtocolo( protocolo.getIdProtocolo() );
				versao.setNrVersao( -1 );
				versao.setTpSituacao( "R" );
				versao.setIdUsuarioAbriu( usuario.idUsuario() );
				versao.setIdUsuarioResponsavel( usuario.idUsuario() );
				versao.setDtInclusao( agora );
				versao.setDtAlteracao( agora );
				versao.setSnPermiteConvidados( false );
				versao.setSnGestorFinaliza( true );
				versao.setDsTitulo( titulo );
				versao.setDsDescricao( descricao.isEmpty() ? null : descricao );
				new ProtocoloVersaoNegocio( conexao, versao ).insere();

				id = protocolo.getIdProtocolo();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, id );
	}

	public JSONObject excluir( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersao = UUID.fromString( exigirRascunho( conexao, usuario.idUsuario(), idProtocolo ) );
				if( existe( conexao, "select 1 from Processos.PROCESSOS p join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = p.ID_PROTOCOLO_VERSAO where v.ID_PROTOCOLO = :id", idProtocolo ) ) {
					throw new ArgousFormsApiException( 409, "PROTOCOLO_EM_USO", "Um Processo já foi iniciado a partir deste Protocolo." );
				}
				if( existe( conexao, "select 1 from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO = :id and NR_VERSAO > 0", idProtocolo ) ) {
					throw new ArgousFormsApiException( 409, "PROTOCOLO_PUBLICADO", "A exclusão de Protocolos publicados ainda não está disponível." );
				}
				if( existe( conexao, "select 1 from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_VERSAO = :id", idVersao ) ) {
					throw new ArgousFormsApiException( 409, "PROTOCOLO_COM_FLUXO", "Este Protocolo já possui etapas; sua exclusão exige revisão do fluxo." );
				}
				List<UUID> modelosPdf = new ArrayList<>();
				List<UUID> modelosHtml = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select x.ID_PROTOCOLO_DOCUMENTO, v.TP_MODELO from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x " +
						"join Processos.PROTOCOLO_DOCUMENTO_VERSOES v on v.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO " +
						"where x.ID_PROTOCOLO_VERSAO = :versao" );
					query.setParameter( "versao", idVersao.toString() );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						("H".equals( query.getString( "TP_MODELO" ) ) ? modelosHtml : modelosPdf)
							.add( UUID.fromString( query.getString( "ID_PROTOCOLO_DOCUMENTO" ) ) );
					}
					while ( query.next() );
				}
				for( UUID idModelo : modelosPdf ) excluirModeloPdf( conexao, idVersao, idModelo );
				for( UUID idModelo : modelosHtml ) excluirModeloHtml( conexao, idVersao, idModelo );

				List<FormularioVariavel> campos = new ArrayList<>();
				List<Formulario> formularios = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select fv.* from Processos.FORMULARIO_VARIAVEIS fv join Processos.FORMULARIOS f on f.ID_FORMULARIO = fv.ID_FORMULARIO where f.ID_PROTOCOLO_VERSAO = :id" );
					query.setParameter( "id", idVersao.toString() );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						FormularioVariavel campo = new FormularioVariavel();
						FormularioVariavelLocalizador.buscaCampos( campo, query );
						campos.add( campo );
					} while ( query.next() );
				}
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Processos.FORMULARIOS where ID_PROTOCOLO_VERSAO = :id" );
					query.setParameter( "id", idVersao.toString() );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						Formulario formulario = new Formulario();
						FormularioLocalizador.buscaCampos( formulario, query );
						formularios.add( formulario );
					} while ( query.next() );
				}
				for( FormularioVariavel campo : campos ) new FormularioVariavelNegocio( conexao, campo ).exclui();
				for( Formulario formulario : formularios ) new FormularioNegocio( conexao, formulario ).exclui();

				List<ProtocoloVersaoVariavel> associacoes = new ArrayList<>();
				List<ProcotoloVariavelVersao> definicoes = new ArrayList<>();
				List<ProtocoloVariavel> variaveis = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Processos.PROTOCOLO_VERSAO_VARIAVEIS where ID_PROTOCOLO_VERSAO = :id" );
					query.setParameter( "id", idVersao.toString() );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						ProtocoloVersaoVariavel associacao = new ProtocoloVersaoVariavel();
						ProtocoloVersaoVariavelLocalizador.buscaCampos( associacao, query );
						associacoes.add( associacao );
					} while ( query.next() );
				}
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select vv.* from Processos.PROTOCOLO_VARIAVEL_VERSOES vv join Processos.PROTOCOLO_VARIAVEIS v on v.ID_VARIAVEL = vv.ID_VARIAVEL where v.ID_PROTOCOLO = :id" );
					query.setParameter( "id", idProtocolo.toString() );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						ProcotoloVariavelVersao definicao = new ProcotoloVariavelVersao();
						ProcotoloVariavelVersaoLocalizador.buscaCampos( definicao, query );
						definicoes.add( definicao );
					} while ( query.next() );
				}
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Processos.PROTOCOLO_VARIAVEIS where ID_PROTOCOLO = :id" );
					query.setParameter( "id", idProtocolo.toString() );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						ProtocoloVariavel variavel = new ProtocoloVariavel();
						ProtocoloVariavelLocalizador.buscaCampos( variavel, query );
						variaveis.add( variavel );
					} while ( query.next() );
				}
				for( ProtocoloVersaoVariavel associacao : associacoes ) new ProtocoloVersaoVariavelNegocio( conexao, associacao ).exclui();
				for( ProcotoloVariavelVersao definicao : definicoes ) new ProcotoloVariavelVersaoNegocio( conexao, definicao ).exclui();
				for( ProtocoloVariavel variavel : variaveis ) new ProtocoloVariavelNegocio( conexao, variavel ).exclui();
				List<ProtocoloRecurso> recursos = new ArrayList<>();
				try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PROTOCOLO_RECURSO from Processos.PROTOCOLO_RECURSOS where ID_PROTOCOLO = ?" ) ) {
					consulta.setObject( 1, idProtocolo );
					try ( ResultSet linhas = consulta.executeQuery() ) {
						while( linhas.next() ) recursos.add( ProtocoloRecursoLocalizador.buscaProtocoloRecurso( conexao, linhas.getObject( 1, UUID.class ) ) );
					}
				}
				for( ProtocoloRecurso recurso : recursos ) new ProtocoloRecursoNegocio( conexao, recurso ).exclui();
				new ProtocoloVersaoNegocio( conexao, ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, idVersao ) ).exclui();
				new ProtocoloNegocio( conexao, ProtocoloLocalizador.buscaProtocolo( conexao, idProtocolo ) ).exclui();
				conexao.commit();
				return new JSONObject().put( "excluido", true );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject descartarRascunho( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				try ( PreparedStatement bloqueio = conexao.getConnection().prepareStatement( "select ID_PROTOCOLO from Processos.PROTOCOLOS where ID_PROTOCOLO = ? for update" ) ) {
					bloqueio.setObject( 1, idProtocolo );
					try ( ResultSet linha = bloqueio.executeQuery() ) {
						if( !linha.next() ) throw new ArgousFormsApiException( 404, "PROTOCOLO_NAO_ENCONTRADO", "Protocolo não encontrado." );
					}
				}
				UUID idVersao = UUID.fromString( exigirRascunho( conexao, usuario.idUsuario(), idProtocolo ) );
				if( !existe( conexao, "select 1 from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO = :id and NR_VERSAO > 0", idProtocolo ) ) {
					throw new ArgousFormsApiException( 409, "PROTOCOLO_SEM_PUBLICACAO", "Este Protocolo ainda não foi publicado; use Excluir Protocolo." );
				}
				if( existe( conexao, "select 1 from Processos.PROCESSOS where ID_PROTOCOLO_VERSAO = :id", idVersao ) ) {
					throw new ArgousFormsApiException( 409, "RASCUNHO_EM_USO", "Um Processo referencia este rascunho." );
				}

				removerFluxoRascunho( conexao, idVersao );
				List<UUID> modelos = idsDoRascunho( conexao, "select ID_PROTOCOLO_DOCUMENTO from Processos.PROTOCOLO_VERSAO_DOCUMENTOS where ID_PROTOCOLO_VERSAO = ?", idVersao );
				for( UUID idModelo : modelos ) {
					ProtocoloVersaoDocumento vinculo = ProtocoloVersaoDocumentoLocalizador.buscaProtocoloVersaoDocumento( conexao, idVersao, idModelo );
					ProtocoloDocumentoVersao versaoModelo = ProtocoloDocumentoVersaoLocalizador.buscaProtocoloDocumentoVersao( conexao, vinculo.getIdProtocoloDocumentoVersao() );
					if( "H".equals( versaoModelo.getTpModelo() ) ) excluirModeloHtml( conexao, idVersao, idModelo );
					else if( "P".equals( versaoModelo.getTpModelo() ) ) excluirModeloPdf( conexao, idVersao, idModelo );
					else throw new ArgousFormsApiException( 409, "MODELO_DESCONHECIDO", "O rascunho contém um modelo de documento desconhecido." );
				}

				for( UUID idFormulario : idsDoRascunho( conexao, "select ID_FORMULARIO from Processos.FORMULARIOS where ID_PROTOCOLO_VERSAO = ?", idVersao ) ) {
					for( UUID idVariavel : idsDoRascunho( conexao, "select ID_VARIAVEL from Processos.FORMULARIO_VARIAVEIS where ID_FORMULARIO = ?", idFormulario ) ) {
						FormularioVariavel campo = new FormularioVariavel();
						campo.setIdFormulario( idFormulario );
						campo.setIdVariavel( idVariavel );
						new FormularioVariavelNegocio( conexao, campo ).exclui();
					}
					new FormularioNegocio( conexao, FormularioLocalizador.buscaFormulario( conexao, idFormulario ) ).exclui();
				}

				for( UUID idGestor : idsDoRascunho( conexao, "select ID_GESTOR_ELEGIVEL from Processos.PROTOCOLO_GESTORES_ELEGIVEIS where ID_PROTOCOLO_VERSAO = ?", idVersao ) ) {
					new ProtocoloGestorElegivelNegocio( conexao, ProtocoloGestorElegivelLocalizador.buscaProtocoloGestorElegivel( conexao, idGestor ) ).exclui();
				}
				List<UUID> definicoesDoRascunho = idsDoRascunho( conexao, "select vv.ID_VARIAVEL_VERSAO from Processos.PROTOCOLO_VERSAO_VARIAVEIS x join Processos.PROTOCOLO_VARIAVEL_VERSOES vv on vv.ID_VARIAVEL = x.ID_VARIAVEL and vv.NR_VERSAO = x.NR_VERSAO where x.ID_PROTOCOLO_VERSAO = ?", idVersao );
				for( UUID idVariavel : idsDoRascunho( conexao, "select ID_VARIAVEL from Processos.PROTOCOLO_VERSAO_VARIAVEIS where ID_PROTOCOLO_VERSAO = ?", idVersao ) ) {
					ProtocoloVersaoVariavel vinculo = ProtocoloVersaoVariavelLocalizador.buscaPorProtocoloPorVariavel( conexao, idVersao, idVariavel );
					new ProtocoloVersaoVariavelNegocio( conexao, vinculo ).exclui();
				}
				new ProtocoloVersaoNegocio( conexao, ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, idVersao ) ).exclui();

				for( UUID idDefinicao : definicoesDoRascunho ) {
					if( existe( conexao, "select 1 from Processos.PROTOCOLO_VARIAVEL_VERSOES vv join Processos.PROTOCOLO_VERSAO_VARIAVEIS x on x.ID_VARIAVEL = vv.ID_VARIAVEL and x.NR_VERSAO = vv.NR_VERSAO where vv.ID_VARIAVEL_VERSAO = :id", idDefinicao ) ) continue;
					ProcotoloVariavelVersao definicao = new ProcotoloVariavelVersao();
					definicao.setIdVariavelVersao( idDefinicao );
					new ProcotoloVariavelVersaoNegocio( conexao, definicao ).exclui();
				}
				for( UUID idVariavel : idsDoRascunho( conexao, "select ID_VARIAVEL from Processos.PROTOCOLO_VARIAVEIS where ID_PROTOCOLO = ?", idProtocolo ) ) {
					if( !existe( conexao, "select 1 from Processos.PROTOCOLO_VERSAO_VARIAVEIS where ID_VARIAVEL = :id", idVariavel ) ) {
						for( UUID idDefinicao : idsDoRascunho( conexao, "select ID_VARIAVEL_VERSAO from Processos.PROTOCOLO_VARIAVEL_VERSOES where ID_VARIAVEL = ?", idVariavel ) ) {
							ProcotoloVariavelVersao definicao = new ProcotoloVariavelVersao();
							definicao.setIdVariavelVersao( idDefinicao );
							new ProcotoloVariavelVersaoNegocio( conexao, definicao ).exclui();
						}
						new ProtocoloVariavelNegocio( conexao, ProtocoloVariavelLocalizador.buscaProtocoloVariavel( conexao, idVariavel ) ).exclui();
					}
				}
				conexao.commit();
				return new JSONObject().put( "rascunhoDescartado", true );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private void removerFluxoRascunho( Conexao conexao, UUID idVersao ) throws Exception {

		for( UUID idEtapa : idsDoRascunho( conexao, "select ID_PROTOCOLO_ETAPA from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_VERSAO = ?", idVersao ) ) {
			for( UUID idDestinatario : idsDoRascunho( conexao, "select ID_ETAPA_DESTINATARIO from Processos.PROTOCOLO_ETAPA_DESTINATARIOS where ID_PROTOCOLO_ETAPA = ?", idEtapa ) ) {
				new ProtocoloEtapaDestinatarioNegocio( conexao, ProtocoloEtapaDestinatarioLocalizador.buscaProtocoloEtapaDestinatario( conexao, idDestinatario ) ).exclui();
			}
			ProtocoloEtapa etapa = ProtocoloEtapaLocalizador.buscaProtocoloEtapa( conexao, idEtapa );
			if( etapa.getIdEncaminhamento() != null ) {
				etapa.setIdEncaminhamento( null );
				new ProtocoloEtapaNegocio( conexao, etapa ).altera();
			}
		}
		List<UUID> caminhos = idsDoRascunho( conexao, "select ID_ENCAMINHAMENTO from Processos.ENCAMINHAMENTOS where ID_PROTOCOLO_VERSAO = ?", idVersao );
		for( UUID idCaminho : caminhos ) {
			Encaminhamento caminho = EncaminhamentoLocalizador.buscaEncaminhamento( conexao, idCaminho );
			if( caminho.getIdProximoEncaminhamento() != null ) {
				caminho.setIdProximoEncaminhamento( null );
				new EncaminhamentoNegocio( conexao, caminho ).altera();
			}
		}
		for( UUID idCaminho : caminhos ) new EncaminhamentoNegocio( conexao, EncaminhamentoLocalizador.buscaEncaminhamento( conexao, idCaminho ) ).exclui();
		for( UUID idEtapa : idsDoRascunho( conexao, "select ID_PROTOCOLO_ETAPA from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_VERSAO = ?", idVersao ) ) {
			new ProtocoloEtapaNegocio( conexao, ProtocoloEtapaLocalizador.buscaProtocoloEtapa( conexao, idEtapa ) ).exclui();
		}
	}

	private List<UUID> idsDoRascunho( Conexao conexao, String sql, UUID id ) throws Exception {

		List<UUID> ids = new ArrayList<>();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, id );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) ids.add( linhas.getObject( 1, UUID.class ) );
			}
		}
		return ids;
	}

	private boolean existe( Conexao conexao, String sql, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( sql );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	public JSONObject salvarDados( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, String tituloInformado, String descricaoInformada, boolean gestorFinaliza ) throws Exception {

		exigirCriador( usuario );
		String titulo = titulo( tituloInformado );
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String idVersao = exigirRascunho( conexao, usuario.idUsuario(), idProtocolo );
				Protocolo protocolo = ProtocoloLocalizador.buscaProtocolo( conexao, idProtocolo );
				protocolo.setDsTitulo( titulo );
				protocolo.setDsDescricao( descricao.isEmpty() ? null : descricao );
				new ProtocoloNegocio( conexao, protocolo ).altera();

				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, UUID.fromString( idVersao ) );
				versao.setDsTitulo( titulo );
				versao.setDsDescricao( descricao.isEmpty() ? null : descricao );
				versao.setSnGestorFinaliza( gestorFinaliza );
				versao.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	private String titulo( String informado ) throws ArgousFormsApiException {

		String titulo = informado == null ? "" : informado.strip();
		if( titulo.isEmpty() || titulo.length() > 255 ) {
			throw new ArgousFormsApiException( 400, "PROTOCOLO_INVALIDO", "Informe um título de Protocolo com até 255 caracteres." );
		}
		return titulo;
	}

	public JSONObject salvarFormulario( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idFormulario, String tituloInformado, String descricaoInformada, JSONArray campos ) throws Exception {

		exigirCriador( usuario );
		String titulo = tituloInformado == null ? "" : tituloInformado.strip();
		if( titulo.isEmpty() || titulo.length() > 255 ) throw new ArgousFormsApiException( 400, "FORMULARIO_INVALIDO", "Informe um título de formulário com até 255 caracteres." );
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		if( campos.length() > Short.MAX_VALUE ) throw new ArgousFormsApiException( 400, "CAMPOS_INVALIDOS", "O formulário contém campos demais." );

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String idVersao = exigirRascunho( conexao, usuario.idUsuario(), idProtocolo );
				Formulario formulario;
				if( idFormulario == null ) {
					formulario = new Formulario();
					formulario.setIdProtocoloVersao( UUID.fromString( idVersao ) );
					formulario.setDtInclusao( new QtData( Instant.now().toEpochMilli() ) );
				} else {
					formulario = FormularioLocalizador.buscaFormulario( conexao, idFormulario );
					if( formulario == null || !UUID.fromString( idVersao ).equals( formulario.getIdProtocoloVersao() ) ) {
						throw new ArgousFormsApiException( 404, "FORMULARIO_NAO_ENCONTRADO", "Formulário não encontrado neste rascunho." );
					}
				}
				formulario.setDsTitulo( titulo );
				formulario.setDsDescricao( descricao.isEmpty() ? null : descricao );
				if( idFormulario == null ) new FormularioNegocio( conexao, formulario ).insere();
				else new FormularioNegocio( conexao, formulario ).altera();

				Set<UUID> ids = new HashSet<>();
				for( int indice = 0; indice < campos.length(); indice++ ) {
					JSONObject campo = campos.getJSONObject( indice );
					UUID idVariavel = UUID.fromString( campo.getString( "idVariavel" ) );
					if( !ids.add( idVariavel ) ) throw new ArgousFormsApiException( 400, "CAMPOS_DUPLICADOS", "A mesma variável não pode aparecer duas vezes no formulário." );
					if( !variavelDaVersao( conexao, idVersao, idVariavel ) ) {
						throw new ArgousFormsApiException( 400, "VARIAVEL_INVALIDA", "A variável não pertence ao rascunho deste Protocolo." );
					}
					String acesso = campo.optString( "acesso", "E" );
					String apresentacao = campo.optString( "apresentacao", "1" );
					if( !( "L".equals( acesso ) || "E".equals( acesso ) ) || !apresentacao.matches( "[1-6]" ) ) {
						throw new ArgousFormsApiException( 400, "CAMPO_INVALIDO", "Acesso ou apresentação inválidos em um campo." );
					}
					FormularioVariavel vinculo = FormularioVariavelLocalizador.buscaFormularioVariavel( conexao, formulario.getIdFormulario(), idVariavel );
					if( vinculo == null ) {
						vinculo = new FormularioVariavel();
						vinculo.setIdFormulario( formulario.getIdFormulario() );
						vinculo.setIdVariavel( idVariavel );
					}
					vinculo.setTpAcesso( acesso );
					vinculo.setTpApresentacao( apresentacao );
					vinculo.setSnObrigatoria( campo.optBoolean( "obrigatorio", false ) );
					vinculo.setNrOrdem( indice + 1 );
					if( FormularioVariavelLocalizador.existe( conexao, formulario.getIdFormulario(), idVariavel ) ) new FormularioVariavelNegocio( conexao, vinculo ).altera();
					else new FormularioVariavelNegocio( conexao, vinculo ).insere();
				}
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Processos.FORMULARIO_VARIAVEIS where ID_FORMULARIO = :formulario" );
					query.setParameter( "formulario", formulario.getIdFormulario().toString() );
					query.executeQuery();
					if( !query.isEmpty() ) {
						do {
							UUID idVariavel = UUID.fromString( query.getString( "ID_VARIAVEL" ) );
							if( ids.contains( idVariavel ) ) continue;
							FormularioVariavel antigo = new FormularioVariavel();
							FormularioVariavelLocalizador.buscaCampos( antigo, query );
							new FormularioVariavelNegocio( conexao, antigo ).exclui();
						} while ( query.next() );
					}
				}
				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, UUID.fromString( idVersao ) );
				versao.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				conexao.commit();
				return new JSONObject().put( "idFormulario", formulario.getIdFormulario().toString() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private String exigirRascunho( Conexao conexao, UUID idUsuario, UUID idProtocolo ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select v.ID_PROTOCOLO_VERSAO from Processos.PROTOCOLO_VERSOES v "
				+ "join Processos.PROTOCOLOS p on p.ID_PROTOCOLO = v.ID_PROTOCOLO "
				+ "where p.ID_PROTOCOLO = :protocolo and p.ID_USUARIO_CRIADOR = :usuario and v.NR_VERSAO = -1 and v.ID_USUARIO_RESPONSAVEL = :usuario" );
			query.setParameter( "protocolo", idProtocolo.toString() );
			query.setParameter( "usuario", idUsuario.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "RASCUNHO_NAO_ENCONTRADO", "Rascunho não encontrado ou indisponível para edição." );
			return query.getString( "ID_PROTOCOLO_VERSAO" );
		}
	}

	private boolean variavelDaVersao( Conexao conexao, String idVersao, UUID idVariavel ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_VARIAVEL from Processos.PROTOCOLO_VERSAO_VARIAVEIS where ID_PROTOCOLO_VERSAO = :versao and ID_VARIAVEL = :variavel" );
			query.setParameter( "versao", idVersao );
			query.setParameter( "variavel", idVariavel.toString() );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	private boolean variavelInstituicaoAtiva( Conexao conexao, int idAtributo ) throws Exception {

		String sql = "select ID_ATRIBUTO from Cadastro.VARIAVEIS_INSTITUICAO where ID_ATRIBUTO = ? and TP_ATRIBUTO = 'V' and DT_INVALIDACAO is null";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setInt( 1, idAtributo );
			try ( ResultSet resultado = consulta.executeQuery() ) { return resultado.next(); }
		}
	}

	public JSONObject listar( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		if( !usuario.papeis().contains( "GESTOR_DE_PROTOCOLOS" ) ) exigirCriador( usuario );
		JSONArray protocolos = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao(); Query query = new Query( conexao ) ) {
			query.setSQL( "select p.ID_PROTOCOLO, p.ID_USUARIO_CRIADOR, p.DS_TITULO, p.DS_DESCRICAO, p.DT_INCLUSAO, p.SN_ATIVO, "
				+ "v.ID_PROTOCOLO_VERSAO, v.DT_ALTERACAO, "
				+ "(select max(NR_VERSAO) from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO = p.ID_PROTOCOLO and NR_VERSAO > 0) as NR_PUBLICADA "
				+ "from Processos.PROTOCOLOS p left join Processos.PROTOCOLO_VERSOES v "
				+ "on v.ID_PROTOCOLO = p.ID_PROTOCOLO and v.NR_VERSAO = -1 "
				+ ( usuario.papeis().contains( "GESTOR_DE_PROTOCOLOS" ) ? "where 1 = 1 " : "where p.ID_USUARIO_CRIADOR = :usuario " )
				+ "order by coalesce(v.DT_ALTERACAO, p.DT_INCLUSAO) desc" );
			if( !usuario.papeis().contains( "GESTOR_DE_PROTOCOLOS" ) ) query.setParameter( "usuario", usuario.idUsuario().toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					JSONObject protocolo = new JSONObject();
					protocolo.put( "id", query.getString( "ID_PROTOCOLO" ) );
					protocolo.put( "proprio", query.getString( "ID_USUARIO_CRIADOR" ) != null && usuario.idUsuario().toString().equals( query.getString( "ID_USUARIO_CRIADOR" ) ) );
					protocolo.put( "titulo", query.getString( "DS_TITULO" ) );
					protocolo.put( "descricao", query.getString( "DS_DESCRICAO" ) == null ? "" : query.getString( "DS_DESCRICAO" ) );
					protocolo.put( "criadoEm", query.getString( "DT_INCLUSAO" ) );
					protocolo.put( "atualizadoEm", query.getString( "DT_ALTERACAO" ) == null ? query.getString( "DT_INCLUSAO" ) : query.getString( "DT_ALTERACAO" ) );
					protocolo.put( "ativo", query.getBoolean( "SN_ATIVO" ) );
					String versao = query.getString( "NR_PUBLICADA" );
					protocolo.put( "versaoPublicada", versao == null ? 0 : Integer.parseInt( versao ) );
					protocolo.put( "temRascunho", query.getString( "ID_PROTOCOLO_VERSAO" ) != null );
					protocolos.put( protocolo );
				} while ( query.next() );
			}
		}
		return new JSONObject().put( "protocolos", protocolos );
	}

	public JSONObject consultar( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		exigirCriador( usuario );
		JSONObject protocolo = null;
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select p.ID_PROTOCOLO, p.DS_TITULO, p.DS_DESCRICAO, p.DT_INCLUSAO, p.SN_ATIVO, p.ID_PASTA, d.DS_NOME as PASTA_NOME, "
					+ "v.ID_PROTOCOLO_VERSAO, v.ID_USUARIO_RESPONSAVEL, v.DT_ALTERACAO, v.SN_GESTOR_FINALIZA, "
					+ "(select max(NR_VERSAO) from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO = p.ID_PROTOCOLO and NR_VERSAO > 0) as NR_PUBLICADA "
					+ "from Processos.PROTOCOLOS p left join Docs.PASTAS d on d.ID_PASTA = p.ID_PASTA left join Processos.PROTOCOLO_VERSOES v "
					+ "on v.ID_PROTOCOLO = p.ID_PROTOCOLO and v.NR_VERSAO = -1 "
					+ "where p.ID_PROTOCOLO = :protocolo and p.ID_USUARIO_CRIADOR = :usuario" );
				query.setParameter( "protocolo", idProtocolo.toString() );
				query.setParameter( "usuario", usuario.idUsuario().toString() );
				query.executeQuery();
				if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "PROTOCOLO_NAO_ENCONTRADO", "Protocolo não encontrado." );
				protocolo = new JSONObject().put( "id", query.getString( "ID_PROTOCOLO" ) )
					.put( "titulo", query.getString( "DS_TITULO" ) )
					.put( "descricao", query.getString( "DS_DESCRICAO" ) == null ? "" : query.getString( "DS_DESCRICAO" ) )
					.put( "criadoEm", query.getString( "DT_INCLUSAO" ) )
					.put( "atualizadoEm", query.getString( "DT_ALTERACAO" ) == null ? query.getString( "DT_INCLUSAO" ) : query.getString( "DT_ALTERACAO" ) )
					.put( "ativo", query.getBoolean( "SN_ATIVO" ) );
				String publicada = query.getString( "NR_PUBLICADA" );
				protocolo.put( "versaoPublicada", publicada == null ? 0 : Integer.parseInt( publicada ) );
				String idVersao = query.getString( "ID_PROTOCOLO_VERSAO" );
				if( idVersao != null ) {
					JSONObject rascunho = new JSONObject().put( "id", idVersao ).put( "idUsuarioResponsavel", query.getString( "ID_USUARIO_RESPONSAVEL" ) )
						.put( "gestorFinaliza", query.getBoolean( "SN_GESTOR_FINALIZA" ) )
						.put( "numero", -1 ).put( "variaveis", new JSONArray() ).put( "formularios", new JSONArray() )
						.put( "etapas", new JSONArray() ).put( "documentos", new JSONArray() );
					String idPasta = query.getString( "ID_PASTA" );
					rascunho.put( "pasta", idPasta == null ? JSONObject.NULL : idPasta );
					rascunho.put( "pastaNome", query.getString( "PASTA_NOME" ) == null ? JSONObject.NULL : query.getString( "PASTA_NOME" ) );
					protocolo.put( "rascunho", rascunho );
				}
			}
			if( !protocolo.has( "rascunho" ) ) return protocolo;
			JSONObject rascunho = protocolo.getJSONObject( "rascunho" );
			if( !rascunho.isNull( "pasta" ) ) rascunho.put( "pastaCaminho", caminhoPasta( conexao, rascunho.getString( "pasta" ) ) );
			carregarVariaveis( conexao, rascunho );
			carregarFormularios( conexao, rascunho );
			carregarModelosPdf( conexao, rascunho );
			carregarGestoresElegiveis( conexao, rascunho );
		}
		return protocolo;
	}

	private void carregarGestoresElegiveis( Conexao conexao, JSONObject rascunho ) throws Exception {

		JSONArray gestores = new JSONArray();
		String sql = "select ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG_GRUPO, CD_TAG_USUARIO, CD_TAG_VINCULO from Processos.PROTOCOLO_GESTORES_ELEGIVEIS where ID_PROTOCOLO_VERSAO = ? order by ID_GESTOR_ELEGIVEL";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, UUID.fromString( rascunho.getString( "id" ) ) );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) gestores.put( new JSONObject()
					.put( "idUsuarioSistema", linhas.getString( "ID_USUARIO_SISTEMA" ) == null ? "" : linhas.getString( "ID_USUARIO_SISTEMA" ) )
					.put( "idGrupo", linhas.getString( "ID_GRUPO" ) == null ? "" : linhas.getString( "ID_GRUPO" ) )
					.put( "cdTagGrupo", linhas.getString( "CD_TAG_GRUPO" ) == null ? "" : linhas.getString( "CD_TAG_GRUPO" ) )
					.put( "cdTagUsuario", linhas.getString( "CD_TAG_USUARIO" ) == null ? "" : linhas.getString( "CD_TAG_USUARIO" ) )
					.put( "cdTagVinculo", linhas.getString( "CD_TAG_VINCULO" ) == null ? "" : linhas.getString( "CD_TAG_VINCULO" ) ) );
			}
		}
		rascunho.put( "gestoresElegiveis", gestores );
	}

	public JSONObject consultarPublicado( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, int numeroVersao ) throws Exception {

		if( !usuario.papeis().contains( "GESTOR_DE_PROTOCOLOS" ) ) exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			JSONObject protocolo = new JSONObject();
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select p.ID_USUARIO_CRIADOR, p.ID_PASTA, v.ID_PROTOCOLO_VERSAO, v.NR_VERSAO, v.DS_TITULO, v.DS_DESCRICAO, v.DT_PUBLICACAO, v.SN_GESTOR_FINALIZA from Processos.PROTOCOLOS p join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO = p.ID_PROTOCOLO where p.ID_PROTOCOLO = ? and v.NR_VERSAO = ? and v.TP_SITUACAO = 'P'" ) ) {
				consulta.setObject( 1, idProtocolo );
				consulta.setInt( 2, numeroVersao );
				try ( ResultSet linha = consulta.executeQuery() ) {
					if( !linha.next() ) throw new ArgousFormsApiException( 404, "VERSAO_NAO_ENCONTRADA", "Versão publicada não encontrada." );
					if( !usuario.papeis().contains( "GESTOR_DE_PROTOCOLOS" ) && !usuario.idUsuario().toString().equals( linha.getString( "ID_USUARIO_CRIADOR" ) ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não pode consultar este Protocolo." );
					protocolo.put( "id", idProtocolo.toString() ).put( "idVersao", linha.getString( "ID_PROTOCOLO_VERSAO" ) ).put( "numero", linha.getInt( "NR_VERSAO" ) )
						.put( "gestorFinaliza", linha.getBoolean( "SN_GESTOR_FINALIZA" ) )
						.put( "titulo", linha.getString( "DS_TITULO" ) ).put( "descricao", linha.getString( "DS_DESCRICAO" ) == null ? "" : linha.getString( "DS_DESCRICAO" ) )
						.put( "publicadoEm", linha.getString( "DT_PUBLICACAO" ) ).put( "pasta", linha.getString( "ID_PASTA" ) == null ? JSONObject.NULL : linha.getString( "ID_PASTA" ) )
						.put( "variaveis", new JSONArray() ).put( "formularios", new JSONArray() ).put( "documentos", new JSONArray() );
				}
			}
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select NR_VERSAO from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO = ? and NR_VERSAO > 0 and TP_SITUACAO = 'P' order by NR_VERSAO desc" ) ) {
				consulta.setObject( 1, idProtocolo );
				JSONArray versoes = new JSONArray();
				try ( ResultSet linhas = consulta.executeQuery() ) { while( linhas.next() ) versoes.put( linhas.getInt( 1 ) ); }
				protocolo.put( "versoes", versoes );
			}
			carregarVariaveis( conexao, new JSONObject().put( "id", protocolo.getString( "idVersao" ) ).put( "variaveis", protocolo.getJSONArray( "variaveis" ) ) );
			carregarFormularios( conexao, new JSONObject().put( "id", protocolo.getString( "idVersao" ) ).put( "formularios", protocolo.getJSONArray( "formularios" ) ) );
			carregarModelosPdf( conexao, new JSONObject().put( "id", protocolo.getString( "idVersao" ) ).put( "documentos", protocolo.getJSONArray( "documentos" ) ) );
			JSONArray recursos = new JSONArray();
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select CD_RECURSO, ID_ARQUIVO_VERSAO from Processos.PROTOCOLO_RECURSOS where ID_PROTOCOLO = ? order by CD_RECURSO" ) ) {
				consulta.setObject( 1, idProtocolo );
				try ( ResultSet linhas = consulta.executeQuery() ) {
					while( linhas.next() ) recursos.put( new JSONObject().put( "codigo", linhas.getString( 1 ) ).put( "idArquivoVersao", linhas.getString( 2 ) ) );
				}
			}
			protocolo.put( "recursosAtuais", recursos );
			return protocolo;
		}
	}

	private void carregarModelosPdf( Conexao conexao, JSONObject rascunho ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select d.ID_PROTOCOLO_DOCUMENTO, d.CD_DOCUMENTO, d.DS_TITULO, d.DS_OBSERVACOES, " +
				"v.ID_PROTOCOLO_DOCUMENTO_VERSAO, v.NR_VERSAO, v.NR_DIAS_VENCIMENTO, pdf.ID_ARQUIVO_MODELO_PDF, " +
				"a.ID_ARQUIVO, a.DS_NOME_ARQUIVO " +
				"from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x " +
				"join Processos.PROTOCOLO_DOCUMENTOS d on d.ID_PROTOCOLO_DOCUMENTO = x.ID_PROTOCOLO_DOCUMENTO " +
				"join Processos.PROTOCOLO_DOCUMENTO_VERSOES v on v.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO " +
				"join Processos.PROTOCOLO_DOCUMENTO_PDF pdf on pdf.ID_PROTOCOLO_DOCUMENTO_VERSAO = v.ID_PROTOCOLO_DOCUMENTO_VERSAO " +
				"join Docs.ARQUIVO_VERSOES av on av.ID_ARQUIVO_VERSAO = pdf.ID_ARQUIVO_MODELO_PDF " +
				"join Docs.ARQUIVOS a on a.ID_ARQUIVO = av.ID_ARQUIVO " +
				"where x.ID_PROTOCOLO_VERSAO = :versao order by d.DS_TITULO" );
			query.setParameter( "versao", rascunho.getString( "id" ) );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				rascunho.getJSONArray( "documentos" ).put( new JSONObject()
					.put( "id", query.getString( "ID_PROTOCOLO_DOCUMENTO" ) )
					.put( "codigo", query.getString( "CD_DOCUMENTO" ) )
					.put( "titulo", query.getString( "DS_TITULO" ) )
					.put( "observacoes", query.getString( "DS_OBSERVACOES" ) == null ? "" : query.getString( "DS_OBSERVACOES" ) )
					.put( "idVersao", query.getString( "ID_PROTOCOLO_DOCUMENTO_VERSAO" ) )
					.put( "versao", query.getInt( "NR_VERSAO" ) )
					.put( "diasVencimento", query.getString( "NR_DIAS_VENCIMENTO" ) == null ? JSONObject.NULL : query.getInt( "NR_DIAS_VENCIMENTO" ) )
					.put( "idArquivoVersao", query.getString( "ID_ARQUIVO_MODELO_PDF" ) )
					.put( "idArquivo", query.getString( "ID_ARQUIVO" ) )
					.put( "arquivoNome", query.getString( "DS_NOME_ARQUIVO" ) )
					.put( "campos", carregarCamposPdf( conexao, UUID.fromString( query.getString( "ID_PROTOCOLO_DOCUMENTO_VERSAO" ) ) ) ) );
			} while ( query.next() );
		}
		carregarModelosHtml( conexao, rascunho );
	}

	private void carregarModelosHtml( Conexao conexao, JSONObject rascunho ) throws Exception {

		String sql = "select d.ID_PROTOCOLO_DOCUMENTO, d.CD_DOCUMENTO, d.DS_TITULO, d.DS_OBSERVACOES, " +
			"v.ID_PROTOCOLO_DOCUMENTO_VERSAO, v.NR_VERSAO, v.NR_DIAS_VENCIMENTO, html.TX_CSS " +
			"from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x " +
			"join Processos.PROTOCOLO_DOCUMENTOS d on d.ID_PROTOCOLO_DOCUMENTO = x.ID_PROTOCOLO_DOCUMENTO " +
			"join Processos.PROTOCOLO_DOCUMENTO_VERSOES v on v.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO " +
			"join Processos.PROTOCOLO_DOCUMENTO_HTML html on html.ID_PROTOCOLO_DOCUMENTO_VERSAO = v.ID_PROTOCOLO_DOCUMENTO_VERSAO " +
			"where x.ID_PROTOCOLO_VERSAO = ? order by d.DS_TITULO";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, UUID.fromString( rascunho.getString( "id" ) ) );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) {
					UUID idVersao = resultado.getObject( "ID_PROTOCOLO_DOCUMENTO_VERSAO", UUID.class );
					rascunho.getJSONArray( "documentos" ).put( new JSONObject()
						.put( "id", resultado.getString( "ID_PROTOCOLO_DOCUMENTO" ) )
						.put( "codigo", resultado.getString( "CD_DOCUMENTO" ) )
						.put( "titulo", resultado.getString( "DS_TITULO" ) )
						.put( "observacoes", resultado.getString( "DS_OBSERVACOES" ) == null ? "" : resultado.getString( "DS_OBSERVACOES" ) )
						.put( "idVersao", idVersao.toString() ).put( "versao", resultado.getInt( "NR_VERSAO" ) )
						.put( "diasVencimento", resultado.getObject( "NR_DIAS_VENCIMENTO" ) == null ? JSONObject.NULL : resultado.getInt( "NR_DIAS_VENCIMENTO" ) )
						.put( "tipoModelo", "H" ).put( "css", resultado.getString( "TX_CSS" ) == null ? "" : resultado.getString( "TX_CSS" ) )
						.put( "partes", carregarPartesHtml( conexao, idVersao ) ) );
				}
			}
		}
	}

	private JSONArray carregarPartesHtml( Conexao conexao, UUID idVersao ) throws Exception {

		JSONArray partes = new JSONArray();
		String sql = "select TP_PARTE, NR_ORDEM, TX_HTML from Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES " +
			"where ID_PROTOCOLO_DOCUMENTO_VERSAO = ? order by case TP_PARTE when 'A' then 1 when 'H' then 2 " +
			"when 'B' then 3 when 'F' then 4 else 5 end, NR_ORDEM";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersao );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) partes.put( new JSONObject().put( "tipo", resultado.getString( "TP_PARTE" ) )
					.put( "ordem", resultado.getInt( "NR_ORDEM" ) ).put( "html", resultado.getString( "TX_HTML" ) ) );
			}
		}
		return partes;
	}

	private JSONArray carregarCamposPdf( Conexao conexao, UUID idVersaoModelo ) throws Exception {

		JSONArray campos = new JSONArray();
		String sql = "select ID_PDF_CAMPO, ID_VARIAVEL, ID_ATRIBUTO, NR_PAGINA, VL_POS_X, VL_POS_Y, VL_LARGURA, VL_ALTURA, JS_APRESENTACAO " +
			"from Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS where ID_PROTOCOLO_DOCUMENTO_VERSAO = ? order by NR_PAGINA, ID_PDF_CAMPO";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersaoModelo );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) {
					campos.put( new JSONObject().put( "id", resultado.getString( "ID_PDF_CAMPO" ) )
						.put( "idVariavel", resultado.getString( "ID_VARIAVEL" ) == null ? JSONObject.NULL : resultado.getString( "ID_VARIAVEL" ) )
						.put( "idAtributo", resultado.getObject( "ID_ATRIBUTO" ) == null ? JSONObject.NULL : resultado.getInt( "ID_ATRIBUTO" ) )
						.put( "pagina", resultado.getInt( "NR_PAGINA" ) )
						.put( "x", resultado.getBigDecimal( "VL_POS_X" ) ).put( "y", resultado.getBigDecimal( "VL_POS_Y" ) )
						.put( "largura", resultado.getBigDecimal( "VL_LARGURA" ) ).put( "altura", resultado.getBigDecimal( "VL_ALTURA" ) )
						.put( "apresentacao", new JSONObject( resultado.getString( "JS_APRESENTACAO" ) ) ) );
				}
			}
		}
		return campos;
	}

	private String caminhoPasta( Conexao conexao, String idPasta ) throws Exception {

		String sql = "with recursive caminho as (" +
				"select ID_PASTA, ID_PASTA_PAI, DS_NOME::text as CAMINHO, array[ID_PASTA] as VISITADOS from Docs.PASTAS where ID_PASTA = ? " +
				"union all select pai.ID_PASTA, pai.ID_PASTA_PAI, pai.DS_NOME || ' / ' || atual.CAMINHO, atual.VISITADOS || pai.ID_PASTA " +
				"from Docs.PASTAS pai join caminho atual on pai.ID_PASTA = atual.ID_PASTA_PAI where not pai.ID_PASTA = any(atual.VISITADOS)) " +
				"select CAMINHO from caminho order by cardinality(VISITADOS) desc limit 1";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, UUID.fromString( idPasta ) );
			try ( ResultSet resultado = consulta.executeQuery() ) { return resultado.next() ? resultado.getString( 1 ) : ""; }
		}
	}

	public void registrarModeloPdf( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idArquivoVersao,
		String codigoInformado, String tituloInformado, String observacoesInformadas, Integer diasVencimento ) throws Exception {

		exigirCriador( usuario );
		String codigo = codigoInformado == null ? "" : codigoInformado.strip();
		String titulo = tituloInformado == null ? "" : tituloInformado.strip();
		String observacoes = observacoesInformadas == null ? "" : observacoesInformadas.strip();
		if( codigo.isEmpty() || codigo.length() > 30 || titulo.isEmpty() || titulo.length() > 70 ) {
			throw new ArgousFormsApiException( 400, "MODELO_INVALIDO", "Informe código de até 30 caracteres e título de até 70 caracteres." );
		}
		validarDiasVencimento( diasVencimento );

		UUID idProtocoloVersao = UUID.fromString( exigirRascunho( conexao, usuario.idUsuario(), idProtocolo ) );
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select av.ID_ARQUIVO_VERSAO from Docs.ARQUIVO_VERSOES av " +
				"join Docs.ARQUIVOS a on a.ID_ARQUIVO = av.ID_ARQUIVO " +
				"join Docs.PASTAS pasta on pasta.ID_PASTA = a.ID_PASTA " +
				"join Processos.PROTOCOLOS p on p.ID_PASTA = pasta.ID_PASTA_PAI " +
				"where p.ID_PROTOCOLO = :protocolo and av.ID_ARQUIVO_VERSAO = :arquivo " +
				"and av.ID_USUARIO_INCLUIU = :usuario and upper(pasta.DS_NOME) = 'MODELOS' " +
				"and a.CD_CONTENT_TYPE = 'application/pdf' and a.DT_LIXEIRA is null and a.DT_EXCLUSAO is null " +
				"and pasta.DT_LIXEIRA is null and pasta.DT_EXCLUSAO is null" );
			query.setParameter( "protocolo", idProtocolo.toString() );
			query.setParameter( "arquivo", idArquivoVersao.toString() );
			query.setParameter( "usuario", usuario.idUsuario().toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 400, "PDF_INVALIDO", "O PDF precisa estar na subpasta MODELOS deste Protocolo e ter sido enviado por você." );
		}

		QtData agora = new QtData( Instant.now().toEpochMilli() );
		ProtocoloDocumento documento = new ProtocoloDocumento();
		documento.setIdProtocolo( idProtocolo );
		documento.setCdDocumento( codigo );
		documento.setDsTitulo( titulo );
		documento.setDsObservacoes( observacoes.isEmpty() ? null : observacoes );
		documento.setDtInclusao( agora );
		new ProtocoloDocumentoNegocio( conexao, documento ).insere();

		ProtocoloDocumentoVersao versao = new ProtocoloDocumentoVersao();
		versao.setIdProtocoloDocumento( documento.getIdProtocoloDocumento() );
		versao.setNrVersao( 1 );
		versao.setTpModelo( "P" );
		versao.setNrDiasVencimento( diasVencimento );
		versao.setDtInclusao( agora );
		new ProtocoloDocumentoVersaoNegocio( conexao, versao ).insere();

		ProtocoloDocumentoPDF pdf = new ProtocoloDocumentoPDF();
		pdf.setIdProtocoloDocumentoVersao( versao.getIdProtocoloDocumentoVersao() );
		pdf.setIdArquivoModeloPdf( idArquivoVersao );
		pdf.setDtInclusao( agora );
		new ProtocoloDocumentoPDFNegocio( conexao, pdf ).insere();

		ProtocoloVersaoDocumento vinculo = new ProtocoloVersaoDocumento();
		vinculo.setIdProtocoloVersao( idProtocoloVersao );
		vinculo.setIdProtocoloDocumento( documento.getIdProtocoloDocumento() );
		vinculo.setIdProtocoloDocumentoVersao( versao.getIdProtocoloDocumentoVersao() );
		new ProtocoloVersaoDocumentoNegocio( conexao, vinculo ).insere();

		ProtocoloVersao protocoloVersao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, idProtocoloVersao );
		protocoloVersao.setDtAlteracao( agora );
		new ProtocoloVersaoNegocio( conexao, protocoloVersao ).altera();
	}

	public JSONObject salvarModeloHtml( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idModelo,
		String codigoInformado, String tituloInformado, String observacoesInformadas, String cssInformado, JSONArray partesInformadas,
		Integer diasVencimento ) throws Exception {

		exigirCriador( usuario );
		validarDiasVencimento( diasVencimento );
		String codigo = codigoInformado == null ? "" : codigoInformado.strip();
		String titulo = tituloInformado == null ? "" : tituloInformado.strip();
		String observacoes = observacoesInformadas == null ? "" : observacoesInformadas.strip();
		String css = cssInformado == null ? "" : cssInformado;
		if( codigo.isEmpty() || codigo.length() > 30 || titulo.isEmpty() || titulo.length() > 70 || css.length() > 100000 ) {
			throw new ArgousFormsApiException( 400, "MODELO_INVALIDO", "Informe código e título válidos; o CSS deve ter até 100000 caracteres." );
		}
		if( partesInformadas == null || partesInformadas.length() == 0 || partesInformadas.length() > 100 ) {
			throw new ArgousFormsApiException( 400, "PARTES_INVALIDAS", "Informe de 1 a 100 partes para o modelo HTML." );
		}
		List<ProtocoloDocumentoHtmlParte> partes = new ArrayList<>();
		int cabecalhos = 0;
		int rodapes = 0;
		int corpos = 0;
		int apresentacoes = 0;
		int encerramentos = 0;
		for( int indice = 0; indice < partesInformadas.length(); indice++ ) {
			JSONObject entrada = partesInformadas.optJSONObject( indice );
			if( entrada == null ) throw new ArgousFormsApiException( 400, "PARTE_INVALIDA", "Parte HTML inválida." );
			String tipo = entrada.optString( "tipo", "" );
			String html = entrada.optString( "html", "" );
			if( !tipo.matches( "[HABXF]" ) || html.isBlank() || html.length() > 100000 ) {
				throw new ArgousFormsApiException( 400, "PARTE_INVALIDA", "Cada parte deve ter tipo válido e HTML de até 100000 caracteres." );
			}
			int ordem = switch( tipo ) {
				case "H" -> ++cabecalhos;
				case "A" -> ++apresentacoes;
				case "B" -> ++corpos;
				case "X" -> ++encerramentos;
				default -> ++rodapes;
			};
			ProtocoloDocumentoHtmlParte parte = new ProtocoloDocumentoHtmlParte();
			parte.setIdDocumentoHtmlParte( UUID.randomUUID() );
			parte.setTpParte( tipo );
			parte.setNrOrdem( ordem );
			parte.setTxHtml( html );
			partes.add( parte );
		}
		if( corpos == 0 || cabecalhos > 1 || rodapes > 1 ) {
			throw new ArgousFormsApiException( 400, "PARTES_INVALIDAS", "Inclua ao menos uma parte de corpo e, no máximo, um cabeçalho e um rodapé." );
		}

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersaoProtocolo = UUID.fromString( exigirRascunho( conexao, usuario.idUsuario(), idProtocolo ) );
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				UUID idVersaoModelo;
				ProtocoloDocumento documento;
				if( idModelo == null ) {
					documento = new ProtocoloDocumento();
					documento.setIdProtocolo( idProtocolo );
					documento.setCdDocumento( codigo );
					documento.setDtInclusao( agora );
					documento.setDsTitulo( titulo );
					documento.setDsObservacoes( observacoes.isEmpty() ? null : observacoes );
					new ProtocoloDocumentoNegocio( conexao, documento ).insere();

					ProtocoloDocumentoVersao versaoModelo = new ProtocoloDocumentoVersao();
					versaoModelo.setIdProtocoloDocumento( documento.getIdProtocoloDocumento() );
					versaoModelo.setNrVersao( 1 );
					versaoModelo.setTpModelo( "H" );
					versaoModelo.setNrDiasVencimento( diasVencimento );
					versaoModelo.setDtInclusao( agora );
					new ProtocoloDocumentoVersaoNegocio( conexao, versaoModelo ).insere();
					idVersaoModelo = versaoModelo.getIdProtocoloDocumentoVersao();

					ProtocoloDocumentoHTML html = new ProtocoloDocumentoHTML();
					html.setIdProtocoloDocumentoVersao( idVersaoModelo );
					html.setTxCss( css.isBlank() ? null : css );
					html.setDtInclusao( agora );
					new ProtocoloDocumentoHTMLNegocio( conexao, html ).insere();

					ProtocoloVersaoDocumento vinculo = new ProtocoloVersaoDocumento();
					vinculo.setIdProtocoloVersao( idVersaoProtocolo );
					vinculo.setIdProtocoloDocumento( documento.getIdProtocoloDocumento() );
					vinculo.setIdProtocoloDocumentoVersao( idVersaoModelo );
					new ProtocoloVersaoDocumentoNegocio( conexao, vinculo ).insere();
				} else {
					ProtocoloVersaoDocumento vinculo = ProtocoloVersaoDocumentoLocalizador.buscaProtocoloVersaoDocumento( conexao, idVersaoProtocolo, idModelo );
					if( vinculo == null ) throw new ArgousFormsApiException( 404, "MODELO_NAO_ENCONTRADO", "Modelo HTML não encontrado neste rascunho." );
					idVersaoModelo = vinculo.getIdProtocoloDocumentoVersao();
					ProtocoloDocumentoVersao versaoModelo = ProtocoloDocumentoVersaoLocalizador.buscaProtocoloDocumentoVersao( conexao, idVersaoModelo );
					if( versaoModelo == null || !"H".equals( versaoModelo.getTpModelo() ) || versaoModelo.getDtPublicacao() != null ) {
						throw new ArgousFormsApiException( 409, "MODELO_IMUTAVEL", "Este modelo HTML não pode ser alterado." );
					}
					versaoModelo.setNrDiasVencimento( diasVencimento );
					new ProtocoloDocumentoVersaoNegocio( conexao, versaoModelo ).altera();
					documento = ProtocoloDocumentoLocalizador.buscaProtocoloDocumento( conexao, idModelo );
					if( !codigo.equals( documento.getCdDocumento() ) ) throw new ArgousFormsApiException( 400, "CODIGO_IMUTAVEL", "O código técnico do modelo não pode ser alterado." );
					if( documentoPublicado( conexao, idModelo ) ) {
						if( !titulo.equals( documento.getDsTitulo() ) || !Objects.equals( observacoes.isEmpty() ? null : observacoes, documento.getDsObservacoes() ) ) {
							throw new ArgousFormsApiException( 409, "IDENTIDADE_MODELO_IMUTAVEL", "Título e observações do modelo publicado não podem ser alterados." );
						}
					} else {
						documento.setDsTitulo( titulo );
						documento.setDsObservacoes( observacoes.isEmpty() ? null : observacoes );
						new ProtocoloDocumentoNegocio( conexao, documento ).altera();
					}
					ProtocoloDocumentoHTML html = new ProtocoloDocumentoHTML();
					html.setIdProtocoloDocumentoVersao( idVersaoModelo );
					html.setTxCss( css.isBlank() ? null : css );
					html.setDtInclusao( versaoModelo.getDtInclusao() );
					new ProtocoloDocumentoHTMLNegocio( conexao, html ).altera();

					List<UUID> idsPartes = new ArrayList<>();
					try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
						"select ID_DOCUMENTO_HTML_PARTE from Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES where ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
						consulta.setObject( 1, idVersaoModelo );
						try ( ResultSet resultado = consulta.executeQuery() ) {
							while( resultado.next() ) idsPartes.add( resultado.getObject( 1, UUID.class ) );
						}
					}
					for( UUID idParte : idsPartes ) {
						ProtocoloDocumentoHtmlParte antiga = new ProtocoloDocumentoHtmlParte();
						antiga.setIdDocumentoHtmlParte( idParte );
						new ProtocoloDocumentoHtmlParteNegocio( conexao, antiga ).exclui();
					}
				}
				for( ProtocoloDocumentoHtmlParte parte : partes ) {
					parte.setIdProtocoloDocumentoVersao( idVersaoModelo );
					new ProtocoloDocumentoHtmlParteNegocio( conexao, parte ).insere();
				}
				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, idVersaoProtocolo );
				versao.setDtAlteracao( agora );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	public JSONObject salvarCamposPdf( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idModelo, JSONArray campos ) throws Exception {

		exigirCriador( usuario );
		if( campos == null || campos.length() > 500 ) {
			throw new ArgousFormsApiException( 400, "CAMPOS_INVALIDOS", "Envie até 500 campos do PDF." );
		}
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				String idRascunho = exigirRascunho( conexao, usuario.idUsuario(), idProtocolo );
				UUID idVersaoModelo = exigirModeloPdfRascunho( conexao, UUID.fromString( idRascunho ), idModelo );
				List<ProtocoloDocumentoPdfCampo> novos = new ArrayList<>();
				for( int indice = 0; indice < campos.length(); indice++ ) {
					JSONObject informado = campos.optJSONObject( indice );
					if( informado == null ) throw new ArgousFormsApiException( 400, "CAMPO_INVALIDO", "Há um campo PDF inválido." );
					Object referenciaVariavel = informado.opt( "idVariavel" );
					Object referenciaAtributo = informado.opt( "idAtributo" );
					boolean temVariavel = referenciaVariavel != null && !JSONObject.NULL.equals( referenciaVariavel );
					boolean temAtributo = referenciaAtributo != null && !JSONObject.NULL.equals( referenciaAtributo );
					if( temVariavel == temAtributo ) {
						throw new ArgousFormsApiException( 400, "REFERENCIA_INVALIDA", "Cada campo PDF deve referenciar uma variável do Protocolo ou da instituição." );
					}
					UUID idVariavel = null;
					Integer idAtributo = null;
					if( temVariavel ) {
						try { idVariavel = UUID.fromString( informado.getString( "idVariavel" ) ); }
						catch ( Exception e ) { throw new ArgousFormsApiException( 400, "VARIAVEL_INVALIDA", "Escolha uma variável válida." ); }
						if( !variavelDaVersao( conexao, idRascunho, idVariavel ) ) {
							throw new ArgousFormsApiException( 400, "VARIAVEL_INVALIDA", "Uma variável não pertence a este Protocolo." );
						}
					} else {
						if( !( referenciaAtributo instanceof Integer valor ) || valor <= 0 ) {
							throw new ArgousFormsApiException( 400, "ATRIBUTO_INVALIDO", "Escolha uma variável da instituição válida." );
						}
						idAtributo = valor;
						if( !variavelInstituicaoAtiva( conexao, idAtributo ) ) {
							throw new ArgousFormsApiException( 400, "ATRIBUTO_INATIVO", "A variável da instituição não existe ou está inativa." );
						}
					}
					int pagina = informado.optInt( "pagina" );
					if( pagina < 1 || pagina > 32767 ) throw new ArgousFormsApiException( 400, "PAGINA_INVALIDA", "Informe uma página válida." );
					ProtocoloDocumentoPdfCampo campo = new ProtocoloDocumentoPdfCampo();
					campo.setIdProtocoloDocumentoVersao( idVersaoModelo );
					campo.setIdVariavel( idVariavel );
					campo.setIdAtributo( idAtributo );
					campo.setNrPagina( pagina );
					campo.setVlPosX( numeroCampoPdf( informado, "x", false ) );
					campo.setVlPosY( numeroCampoPdf( informado, "y", false ) );
					campo.setVlLargura( numeroCampoPdf( informado, "largura", true ) );
					campo.setVlAltura( numeroCampoPdf( informado, "altura", true ) );
						campo.setJsApresentacao( apresentacaoCampoPdf( informado ) );
					novos.add( campo );
				}
				excluirCamposPdf( conexao, idVersaoModelo );
				for( ProtocoloDocumentoPdfCampo campo : novos ) new ProtocoloDocumentoPdfCampoNegocio( conexao, campo ).insere();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	private UUID exigirModeloPdfRascunho( Conexao conexao, UUID idRascunho, UUID idModelo ) throws Exception {

		String sql = "select x.ID_PROTOCOLO_DOCUMENTO_VERSAO from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x " +
			"join Processos.PROTOCOLO_DOCUMENTO_VERSOES v on v.ID_PROTOCOLO_DOCUMENTO_VERSAO = x.ID_PROTOCOLO_DOCUMENTO_VERSAO " +
			"where x.ID_PROTOCOLO_VERSAO = ? and x.ID_PROTOCOLO_DOCUMENTO = ? and v.TP_MODELO = 'P' for update of x";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idRascunho );
			consulta.setObject( 2, idModelo );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				if( !resultado.next() ) throw new ArgousFormsApiException( 404, "MODELO_NAO_ENCONTRADO", "Modelo PDF não encontrado neste rascunho." );
				return resultado.getObject( 1, UUID.class );
			}
		}
	}

	private BigDecimal numeroCampoPdf( JSONObject informado, String nome, boolean positivo ) throws ArgousFormsApiException {

		try {
			BigDecimal valor = new BigDecimal( informado.get( nome ).toString() );
			if( valor.scale() > 2 || valor.precision() > 10 || valor.signum() < 0 || positivo && valor.signum() == 0 ) {
				throw new NumberFormatException();
			}
			return valor;
		} catch ( Exception e ) {
			throw new ArgousFormsApiException( 400, "DIMENSAO_INVALIDA", "Posição e dimensões do campo PDF devem ser valores válidos em pontos, com duas casas decimais." );
		}
	}

	private String apresentacaoCampoPdf( JSONObject informado ) throws Exception {

		if( !informado.has( "apresentacao" ) ) return "{}";
		JSONObject recebida = informado.optJSONObject( "apresentacao" );
		if( recebida == null ) throw new ArgousFormsApiException( 400, "APRESENTACAO_INVALIDA", "A apresentação do campo PDF deve ser um objeto." );
		JSONObject validada = new JSONObject();
		if( recebida.has( "fonte" ) ) {
			Object fonte = recebida.opt( "fonte" );
			if( !(fonte instanceof String valor) || !(valor.equals( "HELVETICA" ) || valor.equals( "TIMES" ) || valor.equals( "COURIER" )) ) {
				throw new ArgousFormsApiException( 400, "FONTE_INVALIDA", "Escolha uma fonte disponível para o campo PDF." );
			}
			validada.put( "fonte", fonte );
		}
		if( recebida.has( "cor" ) ) {
			Object cor = recebida.opt( "cor" );
			if( !(cor instanceof String valor) || !valor.matches( "#[0-9A-Fa-f]{6}" ) ) {
				throw new ArgousFormsApiException( 400, "COR_INVALIDA", "Informe a cor no formato #RRGGBB." );
			}
			validada.put( "cor", cor );
		}
		if( recebida.has( "tamanho" ) ) {
			Object tamanho = recebida.opt( "tamanho" );
			if( !(tamanho instanceof Number numero) || !Double.isFinite( numero.doubleValue() ) || numero.doubleValue() < 4 || numero.doubleValue() > 72 ) {
				throw new ArgousFormsApiException( 400, "TAMANHO_FONTE_INVALIDO", "O tamanho da fonte deve estar entre 4 e 72 pontos." );
			}
			validada.put( "tamanho", tamanho );
		}
		for( String nome : new String[] { "negrito", "italico", "sublinhado" } ) {
			if( !recebida.has( nome ) ) continue;
			Object valor = recebida.opt( nome );
			if( !(valor instanceof Boolean) ) throw new ArgousFormsApiException( 400, "ESTILO_INVALIDO", "As opções de estilo devem ser verdadeiras ou falsas." );
			validada.put( nome, valor );
		}
		return validada.toString();
	}

	private void excluirCamposPdf( Conexao conexao, UUID idVersaoModelo ) throws Exception {

		List<UUID> ids = new ArrayList<>();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select ID_PDF_CAMPO from Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS where ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
			consulta.setObject( 1, idVersaoModelo );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) ids.add( resultado.getObject( 1, UUID.class ) );
			}
		}
		for( UUID id : ids ) {
			ProtocoloDocumentoPdfCampo campo = new ProtocoloDocumentoPdfCampo();
			campo.setIdPdfCampo( id );
			new ProtocoloDocumentoPdfCampoNegocio( conexao, campo ).exclui();
		}
	}

	public JSONObject excluirModeloPdf( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idModelo ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersao = UUID.fromString( exigirRascunho( conexao, usuario.idUsuario(), idProtocolo ) );
				excluirModeloPdf( conexao, idVersao, idModelo );
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	public JSONObject excluirModeloHtml( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idModelo ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersao = UUID.fromString( exigirRascunho( conexao, usuario.idUsuario(), idProtocolo ) );
				excluirModeloHtml( conexao, idVersao, idModelo );
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	public JSONObject alterarModeloPdf( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idModelo,
		String tituloInformado, String observacoesInformadas, Integer diasVencimento ) throws Exception {

		exigirCriador( usuario );
		String titulo = tituloInformado == null ? "" : tituloInformado.strip();
		String observacoes = observacoesInformadas == null ? "" : observacoesInformadas.strip();
		if( titulo.isEmpty() || titulo.length() > 70 ) throw new ArgousFormsApiException( 400, "MODELO_INVALIDO", "Informe um título de até 70 caracteres." );
		validarDiasVencimento( diasVencimento );

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				UUID idVersao = UUID.fromString( exigirRascunho( conexao, usuario.idUsuario(), idProtocolo ) );
				if( ProtocoloVersaoDocumentoLocalizador.buscaProtocoloVersaoDocumento( conexao, idVersao, idModelo ) == null ) {
					throw new ArgousFormsApiException( 404, "MODELO_NAO_ENCONTRADO", "Modelo PDF não encontrado neste rascunho." );
				}
				UUID idVersaoModelo = exigirModeloPdfRascunho( conexao, idVersao, idModelo );
				ProtocoloDocumentoVersao versaoModelo = ProtocoloDocumentoVersaoLocalizador.buscaProtocoloDocumentoVersao( conexao, idVersaoModelo );
				versaoModelo.setNrDiasVencimento( diasVencimento );
				new ProtocoloDocumentoVersaoNegocio( conexao, versaoModelo ).altera();
				ProtocoloDocumento documento = ProtocoloDocumentoLocalizador.buscaProtocoloDocumento( conexao, idModelo );
					if( documentoPublicado( conexao, idModelo ) ) {
						if( !titulo.equals( documento.getDsTitulo() ) || !Objects.equals( observacoes.isEmpty() ? null : observacoes, documento.getDsObservacoes() ) ) {
							throw new ArgousFormsApiException( 409, "IDENTIDADE_MODELO_IMUTAVEL", "Título e observações do modelo publicado não podem ser alterados." );
						}
					} else {
						documento.setDsTitulo( titulo );
						documento.setDsObservacoes( observacoes.isEmpty() ? null : observacoes );
						new ProtocoloDocumentoNegocio( conexao, documento ).altera();
					}
				ProtocoloVersao versao = ProtocoloVersaoLocalizador.buscaProtocoloVersao( conexao, idVersao );
				versao.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new ProtocoloVersaoNegocio( conexao, versao ).altera();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
		return consultar( usuario, idProtocolo );
	}

	private void validarDiasVencimento( Integer diasVencimento ) {

		if( diasVencimento != null && ( diasVencimento < 1 || diasVencimento > Short.MAX_VALUE ) ) {
			throw new ArgousFormsApiException( 400, "VENCIMENTO_INVALIDO", "Informe um prazo de 1 a 32767 dias ou deixe sem vencimento." );
		}
	}

	private void excluirModeloPdf( Conexao conexao, UUID idVersaoProtocolo, UUID idModelo ) throws Exception {

		ProtocoloVersaoDocumento vinculo = ProtocoloVersaoDocumentoLocalizador.buscaProtocoloVersaoDocumento( conexao, idVersaoProtocolo, idModelo );
		if( vinculo == null ) throw new ArgousFormsApiException( 404, "MODELO_NAO_ENCONTRADO", "Modelo PDF não encontrado neste rascunho." );
		boolean publicado = existe( conexao, "select 1 from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = x.ID_PROTOCOLO_VERSAO where x.ID_PROTOCOLO_DOCUMENTO = :id and v.NR_VERSAO > 0", idModelo );
		UUID idVersaoModelo = vinculo.getIdProtocoloDocumentoVersao();
		if( modeloUsadoEmEtapa( conexao, idVersaoProtocolo, idVersaoModelo ) ) throw new ArgousFormsApiException( 409, "MODELO_EM_USO", "Retire o modelo das etapas antes de removê-lo do rascunho." );
		excluirCamposPdf( conexao, idVersaoModelo );
		ProtocoloDocumentoPDF pdf = ProtocoloDocumentoPDFLocalizador.buscaProtocoloDocumentoPDF( conexao, idVersaoModelo );
		if( pdf != null ) new ProtocoloDocumentoPDFNegocio( conexao, pdf ).exclui();
		new ProtocoloVersaoDocumentoNegocio( conexao, vinculo ).exclui();
		new ProtocoloDocumentoVersaoNegocio( conexao, ProtocoloDocumentoVersaoLocalizador.buscaProtocoloDocumentoVersao( conexao, idVersaoModelo ) ).exclui();
		if( !publicado ) new ProtocoloDocumentoNegocio( conexao, ProtocoloDocumentoLocalizador.buscaProtocoloDocumento( conexao, idModelo ) ).exclui();
	}

	private void excluirModeloHtml( Conexao conexao, UUID idVersaoProtocolo, UUID idModelo ) throws Exception {

		ProtocoloVersaoDocumento vinculo = ProtocoloVersaoDocumentoLocalizador.buscaProtocoloVersaoDocumento( conexao, idVersaoProtocolo, idModelo );
		if( vinculo == null ) throw new ArgousFormsApiException( 404, "MODELO_NAO_ENCONTRADO", "Modelo HTML não encontrado neste rascunho." );
		boolean publicado = existe( conexao, "select 1 from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = x.ID_PROTOCOLO_VERSAO where x.ID_PROTOCOLO_DOCUMENTO = :id and v.NR_VERSAO > 0", idModelo );
		UUID idVersaoModelo = vinculo.getIdProtocoloDocumentoVersao();
		if( modeloUsadoEmEtapa( conexao, idVersaoProtocolo, idVersaoModelo ) ) throw new ArgousFormsApiException( 409, "MODELO_EM_USO", "Retire o modelo das etapas antes de removê-lo do rascunho." );
		ProtocoloDocumentoVersao versaoModelo = ProtocoloDocumentoVersaoLocalizador.buscaProtocoloDocumentoVersao( conexao, idVersaoModelo );
		if( versaoModelo == null || !"H".equals( versaoModelo.getTpModelo() ) ) {
			throw new ArgousFormsApiException( 404, "MODELO_NAO_ENCONTRADO", "Modelo HTML não encontrado neste rascunho." );
		}
		List<UUID> idsPartes = new ArrayList<>();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select ID_DOCUMENTO_HTML_PARTE from Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES where ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
			consulta.setObject( 1, idVersaoModelo );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				while( resultado.next() ) idsPartes.add( resultado.getObject( 1, UUID.class ) );
			}
		}
		for( UUID idParte : idsPartes ) {
			ProtocoloDocumentoHtmlParte parte = new ProtocoloDocumentoHtmlParte();
			parte.setIdDocumentoHtmlParte( idParte );
			new ProtocoloDocumentoHtmlParteNegocio( conexao, parte ).exclui();
		}
		ProtocoloDocumentoHTML html = new ProtocoloDocumentoHTML();
		html.setIdProtocoloDocumentoVersao( idVersaoModelo );
		new ProtocoloDocumentoHTMLNegocio( conexao, html ).exclui();
		new ProtocoloVersaoDocumentoNegocio( conexao, vinculo ).exclui();
		new ProtocoloDocumentoVersaoNegocio( conexao, versaoModelo ).exclui();
		if( !publicado ) new ProtocoloDocumentoNegocio( conexao, ProtocoloDocumentoLocalizador.buscaProtocoloDocumento( conexao, idModelo ) ).exclui();
	}

	private boolean modeloUsadoEmEtapa( Conexao conexao, UUID idVersaoProtocolo, UUID idVersaoModelo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Processos.PROTOCOLOS_ETAPAS where ID_PROTOCOLO_VERSAO = ? and jsonb_exists(JS_GERACAO_DOCUMENTOS -> 'aoFinalizar', ?) limit 1" ) ) {
			consulta.setObject( 1, idVersaoProtocolo );
			consulta.setString( 2, idVersaoModelo.toString() );
			try ( ResultSet linhas = consulta.executeQuery() ) { return linhas.next(); }
		}
	}

	private boolean documentoPublicado( Conexao conexao, UUID idModelo ) throws Exception {

		return existe( conexao, "select 1 from Processos.PROTOCOLO_VERSAO_DOCUMENTOS x join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = x.ID_PROTOCOLO_VERSAO where x.ID_PROTOCOLO_DOCUMENTO = :id and v.NR_VERSAO > 0", idModelo );
	}

	public UUID prepararPastaModelos( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		exigirCriador( usuario );
		exigirRascunho( conexao, usuario.idUsuario(), idProtocolo );
		UUID idPasta;
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select ID_PASTA from Processos.PROTOCOLOS where ID_PROTOCOLO = ? for update" ) ) {
			consulta.setObject( 1, idProtocolo );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				resultado.next();
				idPasta = resultado.getObject( 1, UUID.class );
			}
		}
		if( idPasta == null ) throw new ArgousFormsApiException( 409, "PASTA_OBRIGATORIA", "Associe uma pasta ao Protocolo antes de enviar o PDF." );
		documentos.exigirPastaParaProtocolo( conexao, usuario, idPasta );

		UUID idModelos = null;
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select ID_PASTA from Docs.PASTAS where ID_PASTA_PAI = ? and upper(DS_NOME) = 'MODELOS' and DT_LIXEIRA is null and DT_EXCLUSAO is null" ) ) {
			consulta.setObject( 1, idPasta );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				if( resultado.next() ) idModelos = resultado.getObject( 1, UUID.class );
			}
		}
		if( idModelos == null ) {
			Pasta pasta = new Pasta();
			pasta.setIdPastaPai( idPasta );
			pasta.setDsNome( "MODELOS" );
			pasta.setIdUsuarioCriou( usuario.idUsuario() );
			QtData agora = new QtData( Instant.now().toEpochMilli() );
			pasta.setDtInclusao( agora );
			pasta.setDtAlteracao( agora );
			new PastaNegocio( conexao, pasta ).insere();
			idModelos = pasta.getIdPasta();
		}
		return idModelos;
	}

	public void exigirPastaModelos( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idPastaModelos ) throws Exception {

		exigirCriador( usuario );
		exigirRascunho( conexao, usuario.idUsuario(), idProtocolo );
		UUID idPastaProtocolo;
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select p.ID_PASTA from Processos.PROTOCOLOS p join Docs.PASTAS modelos " +
				"on modelos.ID_PASTA_PAI = p.ID_PASTA where p.ID_PROTOCOLO = :protocolo " +
				"and modelos.ID_PASTA = :pasta and upper(modelos.DS_NOME) = 'MODELOS' " +
				"and modelos.DT_LIXEIRA is null and modelos.DT_EXCLUSAO is null" );
			query.setParameter( "protocolo", idProtocolo.toString() );
			query.setParameter( "pasta", idPastaModelos.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 403, "PASTA_MODELOS_INVALIDA", "A pasta de modelos não pertence a este Protocolo." );
			idPastaProtocolo = UUID.fromString( query.getString( "ID_PASTA" ) );
		}
		documentos.exigirPastaParaProtocolo( conexao, usuario, idPastaProtocolo );
	}

	private void carregarVariaveis( Conexao conexao, JSONObject rascunho ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select x.ID_VARIAVEL, x.CD_VARIAVEL, x.TP_DADO, x.DS_DESCRICAO, vv.NR_VERSAO, vv.DS_NOME, vv.JS_DEFINICAO, "
				+ "exists (select 1 from Processos.PROTOCOLO_VERSAO_VARIAVEIS pub join Processos.PROTOCOLO_VERSOES vp on vp.ID_PROTOCOLO_VERSAO = pub.ID_PROTOCOLO_VERSAO where pub.ID_VARIAVEL = x.ID_VARIAVEL and vp.NR_VERSAO > 0) as PUBLICADA "
				+ "from Processos.PROTOCOLO_VERSAO_VARIAVEIS a "
				+ "join Processos.PROTOCOLO_VARIAVEIS x on x.ID_VARIAVEL = a.ID_VARIAVEL "
				+ "join Processos.PROTOCOLO_VARIAVEL_VERSOES vv on vv.ID_VARIAVEL = a.ID_VARIAVEL and vv.NR_VERSAO = a.NR_VERSAO "
				+ "where a.ID_PROTOCOLO_VERSAO = :versao order by vv.DS_NOME" );
			query.setParameter( "versao", rascunho.getString( "id" ) );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					rascunho.getJSONArray( "variaveis" ).put( new JSONObject().put( "id", query.getString( "ID_VARIAVEL" ) )
						.put( "codigo", query.getString( "CD_VARIAVEL" ) ).put( "tipo", query.getString( "TP_DADO" ) )
						.put( "publicada", query.getBoolean( "PUBLICADA" ) )
						.put( "nome", query.getString( "DS_NOME" ) ).put( "numeroVersaoVariavel", query.getInt( "NR_VERSAO" ) )
							.put( "definicao", new JSONObject( query.getString( "JS_DEFINICAO" ) ) )
						.put( "descricao", query.getString( "DS_DESCRICAO" ) == null ? "" : query.getString( "DS_DESCRICAO" ) ) );
				} while ( query.next() );
			}
		}
	}

	private void carregarFormularios( Conexao conexao, JSONObject rascunho ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select f.ID_FORMULARIO, f.DS_TITULO, f.DS_DESCRICAO from Processos.FORMULARIOS f "
				+ "where f.ID_PROTOCOLO_VERSAO = :versao order by f.DT_INCLUSAO, f.ID_FORMULARIO" );
			query.setParameter( "versao", rascunho.getString( "id" ) );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					JSONObject formulario = new JSONObject().put( "id", query.getString( "ID_FORMULARIO" ) )
						.put( "titulo", query.getString( "DS_TITULO" ) )
						.put( "descricao", query.getString( "DS_DESCRICAO" ) == null ? "" : query.getString( "DS_DESCRICAO" ) )
						.put( "campos", new JSONArray() );
					carregarCampos( conexao, formulario );
					rascunho.getJSONArray( "formularios" ).put( formulario );
				} while ( query.next() );
			}
		}
	}

	private void carregarCampos( Conexao conexao, JSONObject formulario ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_VARIAVEL, TP_ACESSO, SN_OBRIGATORIA, TP_APRESENTACAO "
				+ "from Processos.FORMULARIO_VARIAVEIS where ID_FORMULARIO = :formulario order by NR_ORDEM" );
			query.setParameter( "formulario", formulario.getString( "id" ) );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					formulario.getJSONArray( "campos" ).put( new JSONObject().put( "idVariavel", query.getString( "ID_VARIAVEL" ) )
						.put( "acesso", query.getString( "TP_ACESSO" ) ).put( "obrigatorio", query.getBoolean( "SN_OBRIGATORIA" ) )
						.put( "apresentacao", query.getString( "TP_APRESENTACAO" ) ) );
				} while ( query.next() );
			}
		}
	}

	private void exigirCriador( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "CRIADOR_DE_PROTOCOLOS" ) && !usuario.papeis().contains( "MODELADOR" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode criar Protocolos." );
		}
	}
}
